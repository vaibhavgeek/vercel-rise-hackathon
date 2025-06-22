'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, User, Bot, Menu, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user_message' | 'agent' | 'system';
  content: string;
  timestamp: number;
  user?: string;
  metadata?: any;
}

interface ChatInterfaceProps {
  topic?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ topic = 'mcp_agent_queen' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('User');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseMessage = (msg: any): ChatMessage | null => {
    try {
      // Handle the specific format: {"type":"user_message","content":"...","channel_id":"agent:queen","metadata":{"model":"haiku","name":"cli-user"}}
      if (msg.value?.type === 'user_message') {
        return {
          id: msg.value?.id || `${msg.offset}-${msg.partition}`,
          type: 'user_message',
          content: msg.value?.content || '',
          timestamp: parseInt(msg.timestamp) || Date.now(),
          user: msg.value?.metadata?.name || 'User',
          metadata: msg.value
        };
      }
      
      // Handle agent_response format
      if (msg.value?.type === 'agent_response') {
        return {
          id: msg.value?.id || `${msg.offset}-${msg.partition}`,
          type: 'agent',
          content: msg.value?.content || '',
          timestamp: parseInt(msg.timestamp) || Date.now(),
          user: msg.value?.agent_name || 'Agent',
          metadata: msg.value
        };
      }
      
      // Handle existing format
      return {
        id: msg.value?.id || `${msg.offset}-${msg.partition}`,
        type: msg.value?.type || 'agent',
        content: msg.value?.message || msg.value?.content || msg.value?.text || JSON.stringify(msg.value),
        timestamp: parseInt(msg.timestamp) || Date.now(),
        user: msg.value?.user || msg.value?.metadata?.name || 'Agent',
        metadata: msg.value
      };
    } catch (error) {
      console.error('Error parsing message:', error);
      return null;
    }
  };

  const loadInitialMessages = async () => {
    try {
      const response = await fetch(`/api/kafka/consume?topic=${topic}&limit=5`);
      const data = await response.json();

      if (data.success && data.messages) {
        const chatMessages: ChatMessage[] = data.messages
          .map(parseMessage)
          .filter((msg: any): msg is ChatMessage => msg !== null);

        setMessages(chatMessages.reverse());
      }
    } catch (error) {
      console.error('Error loading initial messages:', error);
    }
  };

  const connectToStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');
    
    const eventSource = new EventSource(`/api/kafka/stream?topic=${topic}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connection':
            console.log('SSE connection established:', data);
            setConnectionStatus('connected');
            break;
            
          case 'message':
            const newMessage = parseMessage(data.data);
            if (newMessage) {
              setMessages(prev => [...prev, newMessage]);
            }
            break;
            
          case 'heartbeat':
            // Keep connection alive
            break;
            
          case 'error':
            console.error('SSE error:', data);
            break;
            
          default:
            console.log('Unknown SSE message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('disconnected');
      
      // Automatic reconnection after 3 seconds
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('Attempting to reconnect SSE...');
          connectToStream();
        }
      }, 3000);
    };
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    setIsLoading(true);
    const messageContent = inputMessage;
    
    try {
      const response = await fetch('/api/kafka/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          key: `user-${userName}`,
          value: {
            type: 'user_message',
            content: messageContent,
            channel_id: `agent:${topic.replace('mcp_agent_', '')}`,
            metadata: {
              model: 'haiku',
              name: userName
            }
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInputMessage('');
        // Message will be received via SSE stream automatically
      } else {
        console.error('Failed to send message:', data.error);
        // Show error to user
        alert('Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error to user
      alert('Error sending message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    // Load initial messages and connect to stream
    loadInitialMessages();
    connectToStream();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [topic]);

  return (
    <div className="flex h-full bg-gray-800 text-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gray-900 border-r border-gray-700 overflow-hidden`}>
        <div className="p-4">
          <button className="flex items-center gap-2 w-full p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
            <Plus size={16} />
            <span className="text-sm">New Chat</span>
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="text-xs text-gray-400 mb-2">Previous Chats</div>
          <div className="space-y-1">
            <div className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer transition-colors">
              <div className="text-sm truncate">Chat with Stellar AI</div>
              <div className="text-xs text-gray-400">Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {sidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <Bot size={20} className="text-green-400" />
              <span className="font-medium">Stellar AI</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            <span className="text-sm text-gray-400">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bot size={48} className="mx-auto mb-4 text-gray-400" />
                <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
                <p className="text-gray-400">Start a conversation with Stellar AI</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {messages.map((message) => (
                <div key={message.id} className="group">
                  {message.type === 'user_message' ? (
                    // User Message
                    <div className="p-4 bg-gray-800">
                      <div className="flex gap-4 max-w-4xl mx-auto">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                          <User size={16} className="text-white" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-gray-100 whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Assistant Message
                    <div className="p-4 bg-gray-700">
                      <div className="flex gap-4 max-w-4xl mx-auto">
                        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                          <Bot size={16} className="text-white" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="text-gray-100 whitespace-pre-wrap">{message.content}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-gray-700 rounded-xl p-3">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Message Stellar AI..."
                className="flex-1 bg-transparent text-white placeholder-gray-400 border-0 outline-none resize-none min-h-[24px] max-h-32"
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '24px'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="p-2 rounded-lg bg-white text-gray-800 hover:bg-gray-200 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="text-xs text-gray-400 text-center mt-2">
              Stellar AI can make mistakes. Consider checking important information.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;