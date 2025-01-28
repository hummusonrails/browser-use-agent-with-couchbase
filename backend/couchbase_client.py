from typing import List
from couchbase.cluster import Cluster
from couchbase.options import ClusterOptions
from couchbase.auth import PasswordAuthenticator
from couchbase.bucket import Bucket
from dotenv import load_dotenv
import couchbase.search as search
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize Couchbase connection
cluster = Cluster(
    os.getenv("COUCHBASE_CONNECTION_STRING"),
    ClusterOptions(
        PasswordAuthenticator(
            os.getenv("COUCHBASE_USERNAME"),
            os.getenv("COUCHBASE_PASSWORD")
        )
    )
)

bucket_name = os.getenv("COUCHBASE_BUCKET")
bucket = cluster.bucket(bucket_name)
scope = bucket.scope('_default')
collection = bucket.default_collection()

def get_couchbase_collection():
    """Returns the default Couchbase collection."""
    return collection

def search_chats(user_id: str, search_text: str) -> List[dict]:
    """
    Searches chats for a given user based on the search_text using Couchbase FTS.

    Args:
        user_id (str): The ID of the user.
        search_text (str): The text to search within chat names.
    Returns:
        List[dict]: A list of chat documents that match the search criteria.
    """
    try:
        # Execute the search query against the specified FTS index
        # Replace 'chat_search' with your actual FTS index name if different
        search_result = cluster.search_query("ai-agent-bucket._default.chat_search", search.QueryStringQuery(search_text))

        # Initialize an empty list to collect results
        results = []

        # Iterate over the search results once and collect the content
        for row in search_result.rows():
            logger.info(f"Found row: {row}")
            results.append(row.content)

        user_chats = [chat for chat in results if chat.get("user_id") == user_id]

        logger.info(f"Search returned {len(user_chats)} chats for user '{user_id}'.")

        return user_chats

    except Exception as e:
        logger.error(f"Error during search: {e}")
        return []
