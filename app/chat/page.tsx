'use client';

import React, { useState } from 'react';
import ChatInterface from '../components/chat-interface';
import KafkaProducer from '../components/kafka-producer';
import KafkaConsumer from '../components/kafka-consumer';
import { MessageCircle, Send, MessageSquare } from 'lucide-react';

type TabType = 'chat' | 'producer' | 'consumer';

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const topics = ['mcp_agent_queen'];

  const tabs = [
    { id: 'chat', label: 'Chat Interface', icon: MessageCircle },
    { id: 'producer', label: 'Message Producer', icon: Send },
    { id: 'consumer', label: 'Message Consumer', icon: MessageSquare }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                MCP Agent Queen Communication Hub
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time messaging with Kafka pub/sub
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'chat' && (
          <div className="h-[calc(100vh-200px)]">
            <ChatInterface topic="mcp_agent_queen" />
          </div>
        )}

        {activeTab === 'producer' && (
          <div className="max-w-4xl mx-auto">
            <KafkaProducer topics={topics} />
          </div>
        )}

        {activeTab === 'consumer' && (
          <div className="max-w-4xl mx-auto">
            <KafkaConsumer topics={topics} />
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-2">Real-time</div>
              <div className="text-sm text-gray-600">
                Messages are delivered instantly via Kafka
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-2">Scalable</div>
              <div className="text-sm text-gray-600">
                Built on AWS MSK for enterprise-grade messaging
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-2">Reliable</div>
              <div className="text-sm text-gray-600">
                Guaranteed message delivery with pub/sub pattern
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}