'use client';

import React, { useState } from 'react';
import { Send, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface ProducerProps {
  topics: string[];
}

interface MessageResult {
  success: boolean;
  message?: string;
  error?: string;
}

const KafkaProducer: React.FC<ProducerProps> = ({ topics }) => {
  const [selectedTopic, setSelectedTopic] = useState(topics[0] || '');
  const [messageKey, setMessageKey] = useState('');
  const [messageValue, setMessageValue] = useState('');
  const [isJsonMode, setIsJsonMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MessageResult | null>(null);

  const sendMessage = async () => {
    if (!selectedTopic || !messageValue.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      let parsedValue;
      
      if (isJsonMode) {
        try {
          parsedValue = JSON.parse(messageValue);
        } catch (e) {
          throw new Error('Invalid JSON format');
        }
      } else {
        parsedValue = { text: messageValue };
      }

      const response = await fetch('/api/kafka/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: selectedTopic,
          key: messageKey || undefined,
          value: parsedValue,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({ success: true, message: 'Message sent successfully!' });
        setMessageValue('');
        setMessageKey('');
      } else {
        setResult({ success: false, error: data.error || 'Failed to send message' });
      }
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <Send className="mr-2" size={24} />
        Message Producer
      </h2>

      <div className="space-y-4">
        {/* Topic Selection */}
        <div>
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

        {/* Message Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Key (Optional)
          </label>
          <input
            type="text"
            value={messageKey}
            onChange={(e) => setMessageKey(e.target.value)}
            placeholder="Enter message key..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Message Format Toggle */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              checked={isJsonMode}
              onChange={() => setIsJsonMode(true)}
              className="mr-2"
            />
            JSON
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={!isJsonMode}
              onChange={() => setIsJsonMode(false)}
              className="mr-2"
            />
            Plain Text
          </label>
        </div>

        {/* Message Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message Value
          </label>
          <textarea
            value={messageValue}
            onChange={(e) => setMessageValue(e.target.value)}
            placeholder={
              isJsonMode
                ? '{\n  "message": "Hello World",\n  "timestamp": "2025-01-01",\n  "data": {\n    "key": "value"\n  }\n}'
                : 'Enter your message here...'
            }
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        {/* Send Button */}
        <button
          onClick={sendMessage}
          disabled={loading || !selectedTopic || !messageValue.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={16} />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2" size={16} />
              Send Message
            </>
          )}
        </button>

        {/* Result Display */}
        {result && (
          <div
            className={`p-4 rounded-md flex items-center ${
              result.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}
          >
            {result.success ? (
              <>
                <CheckCircle className="text-green-600 mr-2" size={20} />
                <span className="text-green-800">{result.message}</span>
              </>
            ) : (
              <>
                <XCircle className="text-red-600 mr-2" size={20} />
                <span className="text-red-800">{result.error}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default KafkaProducer;
