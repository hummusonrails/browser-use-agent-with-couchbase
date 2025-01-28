import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChatDetail({ chat, onBack }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!chat?.chat_id) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`http://localhost:8000/chats/${chat.chat_id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch messages for chat ID: ${chat.chat_id}`);
        }
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [chat?.chat_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
  
    try {
      setLoading(true);
      setError("");
  
      // Post the user's message
      const userMessagePayload = {
        content: inputValue,
        timestamp: new Date().toISOString(),
        sender: "user",
      };
      const userMsgRes = await fetch(
        `http://localhost:8000/chats/${chat.chat_id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userMessagePayload),
        }
      );
      if (!userMsgRes.ok) {
        throw new Error("Failed to post user message.");
      }
      const userMsgData = await userMsgRes.json();
      setMessages((prev) => [...prev, userMsgData]);
  
      // Clear input field
      setInputValue("");
  
      // Call the agent for a response
      const agentTaskPayload = { task: userMessagePayload.content };
      const agentRes = await fetch("http://localhost:8000/run-agent/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentTaskPayload),
      });
      if (!agentRes.ok) {
        throw new Error("Failed to call the agent.");
      }
      const agentResData = await agentRes.json();
      const agentResults = agentResData.results;
  
      // Extract the final message to display
      const finalMessage = agentResults
        .filter((item) => item.is_done && item.extracted_content)
        .map((item) => item.extracted_content)
        .pop() || "Agent response not available.";
  
      // Post the agent's response
      const agentMessagePayload = {
        content: finalMessage,
        timestamp: new Date().toISOString(),
        sender: "agent",
      };
      const agentMsgRes = await fetch(
        `http://localhost:8000/chats/${chat.chat_id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agentMessagePayload),
        }
      );
      if (!agentMsgRes.ok) {
        throw new Error("Failed to post agent message.");
      }
      const agentMsgData = await agentMsgRes.json();
      setMessages((prev) => [...prev, agentMsgData]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };  

  return (
    <div className="flex flex-col h-screen bg-secondary">
      <header className="flex items-center px-4 py-3 bg-secondary text-secondary-foreground">
        <Button variant="ghost" size="icon" className="mr-2" onClick={onBack}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex items-center flex-1">
          <Avatar className="h-8 w-8 mr-3">
            <AvatarImage src={chat.avatar} alt={chat.name} />
            <AvatarFallback>{chat.name?.substring(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">{chat.name || "Unlabeled Chat"}</h1>
            <p className="text-xs opacity-75">Online</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {error && <p className="text-red-500 mb-2 text-sm">{error}</p>}

        {loading && messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Loading messages...
          </p>
        )}

        {messages.length === 0 && !loading && (
          <p className="text-center text-sm text-muted-foreground">
            Send the first message!
          </p>
        )}

        {messages.map((message, index) => {
          const isAgent = message.sender === "agent";
            const avatarSrc = isAgent ? `/avatar_${(index % 2) + 1}.jpg` : null;
            const userAvatarSrc = !isAgent ? `/user_avatar_${(index % 2) + 1}.jpg` : null;

          return (
            <div
              key={index}
              className={cn(
                "flex",
                message.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              {isAgent && (
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={avatarSrc} alt="Agent Icon" />
                  <AvatarFallback>AG</AvatarFallback>
                </Avatar>
              )}
              {!isAgent && (
                <Avatar className="h-8 w-8 mr-3">
                  <AvatarImage src={userAvatarSrc} alt="User Icon" />
                  <AvatarFallback>US</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-background text-foreground rounded-bl-none"
                )}
              >
                {message.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <Card className="border-t rounded-none p-4 bg-background">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            className="flex-1"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            size="icon"
            className="bg-primary hover:bg-primary/90"
            disabled={loading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
