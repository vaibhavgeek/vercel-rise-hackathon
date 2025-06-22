import { NextRequest } from 'next/server';
import { Kafka } from 'kafkajs';
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js');

export const dynamic = 'force-dynamic';

async function oauthBearerTokenProvider(region: any) {
  const authTokenResponse = await generateAuthToken({ region });
  return {
    value: authTokenResponse.token
  };
}

const kafka = new Kafka({
  clientId: 'nextjs-kafka-stream-consumer',
  brokers: process.env.MSK_BOOTSTRAP_SERVERS?.split(',') || [
    'b-3-public.commandhive.aewd11.c4.kafka.ap-south-1.amazonaws.com:9198',
    'b-2-public.commandhive.aewd11.c4.kafka.ap-south-1.amazonaws.com:9198',
    'b-1-public.commandhive.aewd11.c4.kafka.ap-south-1.amazonaws.com:9198'
  ],
  ssl: true,
  sasl: {
    mechanism: 'oauthbearer',
    oauthBearerProvider: () => oauthBearerTokenProvider('ap-south-1')
  },
  connectionTimeout: 3000,
  requestTimeout: 25000,
  retry: {
    initialRetryTime: 100,
    retries: 3
  }
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic') || 'mcp_agent_queen';
  
  // Create a unique consumer group for this SSE connection
  const consumerGroupId = `sse-consumer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const consumer = kafka.consumer({ 
    groupId: consumerGroupId,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log(`Starting SSE stream for topic: ${topic}, consumer: ${consumerGroupId}`);
        
        // Send initial connection message
        const initMessage = `data: ${JSON.stringify({ 
          type: 'connection', 
          status: 'connected',
          topic,
          timestamp: Date.now()
        })}\n\n`;
        controller.enqueue(encoder.encode(initMessage));

        // Connect to Kafka
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });

        // Set up message handler
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            if (!isConnected) return;

            try {
              const messageData = {
                topic,
                partition,
                offset: message.offset,
                timestamp: message.timestamp,
                key: message.key?.toString(),
                value: message.value ? JSON.parse(message.value.toString()) : null,
              };

              // Send message via SSE
              const sseMessage = `data: ${JSON.stringify({
                type: 'message',
                data: messageData,
                timestamp: Date.now()
              })}\n\n`;
              
              controller.enqueue(encoder.encode(sseMessage));
              console.log(`SSE: Sent message from partition ${partition}, offset ${message.offset}`);
              
            } catch (parseError) {
              console.error('Error parsing Kafka message:', parseError);
              
              // Send error message
              const errorMessage = `data: ${JSON.stringify({
                type: 'error',
                message: 'Failed to parse message',
                timestamp: Date.now()
              })}\n\n`;
              
              controller.enqueue(encoder.encode(errorMessage));
            }
          },
        });

        // Send heartbeat every 30 seconds
        const heartbeatInterval = setInterval(() => {
          if (!isConnected) {
            clearInterval(heartbeatInterval);
            return;
          }

          try {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              timestamp: Date.now()
            })}\n\n`;
            
            controller.enqueue(encoder.encode(heartbeat));
          } catch (error) {
            console.error('Heartbeat error:', error);
            clearInterval(heartbeatInterval);
          }
        }, 30000);

      } catch (error) {
        console.error('SSE stream setup error:', error);
        
        const errorMessage = `data: ${JSON.stringify({
          type: 'error',
          message: 'Failed to connect to Kafka',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        })}\n\n`;
        
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      }
    },

    cancel() {
      console.log(`SSE stream cancelled for consumer: ${consumerGroupId}`);
      isConnected = false;
      
      // Cleanup Kafka consumer
      consumer.disconnect().catch(error => {
        console.error('Error disconnecting Kafka consumer:', error);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
}