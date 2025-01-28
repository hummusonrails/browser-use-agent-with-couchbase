from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from browser_use import Agent
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
from couchbase_client import get_couchbase_collection
from tasks.agent_runner import run_browser_agent
from typing import List
from couchbase_client import search_chats
import os
import uuid

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:5173",  # Your frontend URL, change as needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

collection = get_couchbase_collection()

def normalize_email(email: str) -> str:
    """Helper function to normalize email addresses if discrepancies are common."""
    return email.strip().lower()

# ------------------------------------------------------------------
# Models
# ------------------------------------------------------------------

class UserCreate(BaseModel):
    user_id: str
    name: Optional[str]

class ChatCreate(BaseModel):
    user_id: str
    name: Optional[str]

class Message(BaseModel):
    content: str
    timestamp: Optional[str] = None
    sender: Optional[str] = None

class MessageCreate(BaseModel):
    content: str
    timestamp: str
    sender: str

class ChatResponse(BaseModel):
    chat_id: str
    user_id: str
    name: Optional[str] = None
    messages: Optional[List[Message]] = None

class UserResponse(BaseModel):
    user_id: str
    name: Optional[str]
    chat_ids: List[str]


# ------------------------------------------------------------------
# User Endpoints
# ------------------------------------------------------------------

@app.post("/users/", response_model=UserResponse)
def create_user(user: UserCreate):
    user_id = normalize_email(user.user_id)
    doc_key = f"user::{user_id}"

    try:
        # Check if user already exists
        collection.get(doc_key)
        raise HTTPException(status_code=400, detail="User already exists.")
    except:
        pass  # User doesn't exist, proceed to create

    user_doc = {
        "type": "user",
        "user_id": user.user_id,
        "name": user.name,
        "chat_ids": []
    }

    try:
        collection.insert(doc_key, user_doc)
        return user_doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str):
    user_id = normalize_email(user_id)
    doc_key = f"user::{user_id}"

    try:
        result = collection.get(doc_key)
        return result.content_as[dict]
    except Exception as e:
        # If user doesn't exist, create a new one
        new_doc = {
            "type": "user",
            "user_id": user_id,
            "name": user_id, 
            "chat_ids": []
        }

        try:
            collection.insert(doc_key, new_doc)
            return new_doc
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating user: {e}")


@app.get("/users/{user_id}/chats", response_model=List[ChatResponse])
def get_user_chats(user_id: str):
    user_id = normalize_email(user_id)
    doc_key = f"user::{user_id}"

    try:
        # Fetch user document
        user_doc = collection.get(doc_key).content_as[dict]
        chat_ids = user_doc.get("chat_ids", [])

        # Fetch all chat documents for this user
        chats = []
        for chat_id in chat_ids:
            chat_key = f"chat::{chat_id}"
            try:
                chat_doc = collection.get(chat_key).content_as[dict]
                chats.append(chat_doc)
            except Exception as e:
                # Log error for specific chat retrieval failure but continue
                print(f"Error fetching chat {chat_id}: {e}")

        return chats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching user chats: {e}")


# ------------------------------------------------------------------
# Chat Endpoints
# ------------------------------------------------------------------

@app.post("/chats/", response_model=ChatResponse)
def create_chat(chat: ChatCreate):
    chat_id = str(uuid.uuid4())
    chat_name = chat.name or "Unlabeled Chat"
    chat_doc_key = f"chat::{chat_id}"
    user_doc_key = f"user::{chat.user_id}"

    try:
        # Check if user exists
        user_doc = collection.get(user_doc_key).content_as[dict]

        # Create chat document
        chat_doc = {
            "type": "chat",
            "chat_id": chat_id,
            "name": chat_name,
            "user_id": chat.user_id,
            "messages": []
        }
        collection.insert(chat_doc_key, chat_doc)

        # Add chat ID to user's chat_ids array
        user_doc["chat_ids"].append(chat_id)
        collection.replace(user_doc_key, user_doc)

        return chat_doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating chat: {e}")


@app.get("/chats/{chat_id}", response_model=ChatResponse)
def get_chat(chat_id: str):
    chat_doc_key = f"chat::{chat_id}"

    try:
        result = collection.get(chat_doc_key)
        return result.content_as[dict]
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Chat not found: {e}")


@app.post("/chats/{chat_id}/messages", response_model=Message)
def add_message_to_chat(chat_id: str, message: MessageCreate):
    chat_doc_key = f"chat::{chat_id}"

    try:
        # Fetch chat document
        chat_doc = collection.get(chat_doc_key).content_as[dict]

        # Add new message to chat
        new_message = {
            "content": message.content,
            "timestamp": message.timestamp,
            "sender": message.sender
        }
        chat_doc["messages"].append(new_message)

        # Update chat document
        collection.replace(chat_doc_key, chat_doc)

        return new_message
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error adding message: {e}")
    
@app.get("/users/{user_id}/chats/search", response_model=List[ChatResponse])
def search_user_chats(user_id: str, query: str):
    """
    Searches for chats belonging to a user based on a search query.

    Args:
        user_id (str): The ID of the user.
        query (str): The search term to look for in chat names.

    Returns:
        List[ChatResponse]: A list of chats that match the search criteria.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Search query cannot be empty.")

    try:
        # Perform the search using the search_chats function
        searched_chats = search_chats(user_id, query)

        return searched_chats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


# ------------------------------------------------------------------
# Agent Endpoint
# ------------------------------------------------------------------

class TaskRequest(BaseModel):
    task: str

@app.post("/run-agent/")
async def run_agent(task_request: TaskRequest):
    task = task_request.task
    try:
        results = await run_browser_agent(task)
        if results:
            return {"success": True, "results": results}
        return {"success": False, "results": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
