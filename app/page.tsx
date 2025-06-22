'use client';

import ChatInterface from './components/chat-interface';

export default function Home() {
  return (
    <div className="h-screen bg-gray-800">
      <ChatInterface topic="mcp_agent_queen" />
    </div>
  );
}