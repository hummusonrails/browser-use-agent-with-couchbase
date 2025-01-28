import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function ChatList({ onChatSelect, user, setUser, chats, setChats }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [newChatName, setNewChatName] = useState(""); 
  const [showNewChatInput, setShowNewChatInput] = useState(false);

  // Fetch user and their chats
  const fetchChats = async () => {
    if (!email.trim()) {
    setError("Please enter an email address.");
    return;
    }

    try {
    setLoading(true);
    setError("");

    // Fetch or create user details
    const userRes = await fetch(`http://localhost:8000/users/${email}`);
    if (!userRes.ok) {
        throw new Error("Failed to fetch or create user.");
    }
    const userData = await userRes.json();
    setUser(userData);

    // Fetch chats for the user
    const chatsRes = await fetch(`http://localhost:8000/users/${email}/chats`);
    if (!chatsRes.ok) {
        throw new Error("Failed to fetch chats.");
    }
    const chatsData = await chatsRes.json();
    setChats(chatsData);
    } catch (err) {
    setError(err.message);
    setUser(null);
    setChats([]);
    } finally {
    setLoading(false);
    }
};

  // Handle creating a new chat
  const handleNewChat = async () => {
    if (!newChatName.trim() || !user) {
      setError("User must be logged in to create a chat.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const payload = {
        user_id: user.user_id,
        name: newChatName,
      };
      const res = await fetch("http://localhost:8000/chats/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to create new chat.");
      }

      const newChat = await res.json();
      setChats((prev) => [...prev, newChat]);
      setNewChatName("");
      setShowNewChatInput(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="px-4 pt-6 pb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-lg font-semibold">Hello,</h1>
            <p className="text-2xl font-bold">{user ? user.name : "Guest"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* User Email Input */}
        {!user && (
          <div className="flex flex-col items-start">
            <Input
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-2"
            />
            <Button onClick={fetchChats} disabled={loading}>
              {loading ? "Loading..." : "Find or Create User"}
            </Button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {user && chats.length === 0 && !loading && (
          <p className="text-center text-sm text-muted-foreground">
            No chats found. Start a new conversation!
          </p>
        )}

        {chats.map((chat, index) => {
          const avatarIndex = (index % 4) + 1;
          const avatarSrc = `/room_icon_${avatarIndex}.jpg`;

          return (
            <button
              key={chat.chat_id}
              onClick={() => onChatSelect(chat)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarSrc} alt={chat.name || "Unlabeled Chat"} />
                  <AvatarFallback>{(chat.name || "Chat").substring(0, 2)}</AvatarFallback>
                </Avatar>
                {chat.isOnline && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="font-semibold truncate">{chat.name || "Chat"}</p>
                  <span className="text-xs text-muted-foreground">{chat.last_message_time}</span>
                </div>
                <p
                  className={cn(
                    "text-sm truncate",
                    chat.is_typing ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {chat.last_message || "No messages yet"}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {user && showNewChatInput && (
        <Card className="p-4 absolute bottom-20 right-4 w-64">
          <Input
            value={newChatName}
            onChange={(e) => setNewChatName(e.target.value)}
            placeholder="Chat name"
          />
          <div className="flex justify-end mt-2">
            <Button onClick={handleNewChat} className="mr-2">
              Create
            </Button>
            <Button variant="ghost" onClick={() => setShowNewChatInput(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Floating Action Button */}
      {user && (
        <div className="absolute bottom-4 right-4">
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setShowNewChatInput(!showNewChatInput)}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}
    </div>
  );
}
