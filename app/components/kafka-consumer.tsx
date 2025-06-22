'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Loader2, RefreshCw, Clock, Hash, Key } from 'lucide-react';

interface Message {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: string | null;
  value: any;
}

interface ConsumerProps {
  topics: string[];
}

const KafkaConsumer: React.FC<ConsumerProps> = ({ topics }) => {
  const [selectedTopic, setSelectedTopic] = useState(topics[0] || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [messageLimit, setMessageLimit] = useState(5);

  const fetchMessages = async () => {
    if (!selectedTopic) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/kafka/consume?topic=${selectedTopic}&limit=${messageLimit}`
      );
      const data = await response.json();

      if (data.success) {
        setMessages(data.messages);
      } else {
        console.error('Failed to fetch messages:', data.error);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTopic && !loading) {
      fetchMessages();
    }
  }, [selectedTopic]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh && selectedTopic) {
      interval = setInterval(fetchMessages, 5000); // Refresh every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, selectedTopic]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(parseInt(timestamp)).toLocaleString();
  };

  const formatJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <MessageSquare className="mr-2" size={24} />
        Message Consumer
      </h2>

      <div className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end">
          {/* Topic Selection */}
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic
            </label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </div>

          {/* Message Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              value={messageLimit}
              onChange={(e) => setMessageLimit(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Auto Refresh Toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Auto Refresh</span>
          </label>

          {/* Refresh Button */}
          <button
            onClick={fetchMessages}
            disabled={loading}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <RefreshCw className="mr-2" size={16} />
            )}
            Fetch Messages
          </button>
        </div>

        {/* Messages Display */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500">
              No messages found. Try fetching messages from the topic.
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {/* Message Header */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                <div className="flex items-center">
                  <Hash className="mr-1" size={14} />
                  Partition: {message.partition}
                </div>
                <div className="flex items-center">
                  <Hash className="mr-1" size={14} />
                  Offset: {message.offset}
                </div>
                <div className="flex items-center">
                  <Clock className="mr-1" size={14} />
                  {formatTimestamp(message.timestamp)}
                </div>
                {message.key && (
                  <div className="flex items-center">
                    <Key className="mr-1" size={14} />
                    Key: {message.key}
                  </div>
                )}
              </div>

              {/* Message Value */}
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Message Value:</h4>
                <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
                  {formatJson(message.value)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KafkaConsumer;
