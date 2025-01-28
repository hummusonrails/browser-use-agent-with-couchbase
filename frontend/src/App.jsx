import { useState } from "react"
import { ChatList } from "./components/ChatList"
import { ChatDetail } from "./components/ChatDetail"

export default function App() {
  const [selectedChat, setSelectedChat] = useState(null)
  const [chats, setChats] = useState([]);
  const [user, setUser] = useState(null)

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
  };

  const handleBack = () => {
    setSelectedChat(null);
  };

  return (
    <div className="max-w-2xl mx-auto h-screen">
      {!selectedChat ? (
        <ChatList
          onChatSelect={handleChatSelect}
          user={user}
          setUser={setUser}
          chats={chats}
          setChats={setChats}
        />
      ) : (
        <ChatDetail chat={selectedChat} onBack={handleBack} />
      )}
    </div>
  );
}
