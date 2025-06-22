import { NextRequest, NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js')

export const dynamic = 'force-dynamic';

async function oauthBearerTokenProvider(region: any) {
   // Uses AWS Default Credentials Provider Chain to fetch credentials
   const authTokenResponse = await generateAuthToken({ region });
   return {
       value: authTokenResponse.token
   }
}

const kafka = new Kafka({
  clientId: 'nextjs-kafka-consumer',
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
  connectionTimeout: 3000, // Shorter timeout
  requestTimeout: 25000,   // Reasonable request timeout
  retry: {
    initialRetryTime: 100,
    retries: 3 // Fewer retries to avoid timeout issues
  }
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!topic) {
    return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
  }

  const admin = kafka.admin();
  const consumer = kafka.consumer({ 
    groupId: `nextjs-latest-consumer-${Date.now()}`,
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
  });

  const messages: any[] = [];
  let messageCount = 0;
  let isConsuming = true;

  try {
    // 1. Get topic metadata
    await admin.connect();
    const topicOffsets = await admin.fetchTopicOffsets(topic);
    console.log('Topic offsets:', topicOffsets);
    await admin.disconnect();

    // 2. Connect consumer and subscribe
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });

    // 3. Set up the consumer with seek logic
    const runPromise = consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!isConsuming || messageCount >= limit) {
          return;
        }

        try {
          const messageData = {
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key?.toString(),
            value: message.value ? JSON.parse(message.value.toString()) : null,
          };
          
          messages.push(messageData);
          messageCount++;
          
          console.log(`Message ${messageCount}/${limit}: Partition ${partition}, Offset ${message.offset}`);

          // Stop consuming when we have enough messages
          if (messageCount >= limit) {
            isConsuming = false;
            console.log('Reached message limit, stopping consumer...');
          }
        } catch (parseError) {
          console.error('Error parsing message:', parseError);
        }
      },
    });

    // 4. Wait a bit for consumer to be ready, then seek
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 5. Seek to the last N messages across all partitions
    const messagesPerPartition = Math.ceil(limit / topicOffsets.length);
    
    for (const partitionInfo of topicOffsets) {
      try {
        const highOffset = parseInt(partitionInfo.high);
        const lowOffset = parseInt(partitionInfo.low);
        
        // Calculate starting offset (get the last messagesPerPartition messages)
        const startOffset = Math.max(lowOffset, highOffset - messagesPerPartition);
        
        console.log(`Seeking partition ${partitionInfo.partition}: from ${startOffset} to ${highOffset} (${highOffset - startOffset} messages)`);
        
        await consumer.seek({ 
          topic, 
          partition: partitionInfo.partition, 
          offset: startOffset.toString()
        });
      } catch (seekError) {
        console.log(`Seek failed for partition ${partitionInfo.partition}:`, seekError);
      }
    }

    // 6. Wait for messages to be consumed or timeout
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 10000));
    const messagePromise = new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (messageCount >= limit || !isConsuming) {
          clearInterval(checkInterval);
          resolve(void 0);
        }
      }, 200);
    });

    await Promise.race([timeoutPromise, messagePromise]);
    
    // 7. Stop the consumer
    isConsuming = false;
    await consumer.stop();
    await consumer.disconnect();

    // 8. Sort messages by timestamp (latest first) and limit results
    const sortedMessages = messages
      .sort((a, b) => {
        const timestampA = parseInt(a.timestamp || '0');
        const timestampB = parseInt(b.timestamp || '0');
        return timestampB - timestampA; // Latest first
      })
      .slice(0, limit);

    console.log(`Returning ${sortedMessages.length} messages out of ${messageCount} consumed`);

    return NextResponse.json({
      success: true,
      messages: sortedMessages,
      count: sortedMessages.length,
      metadata: {
        totalConsumed: messageCount,
        totalPartitions: topicOffsets.length,
        partitionInfo: topicOffsets.map(p => ({
          partition: p.partition,
          low: p.low,
          high: p.high,
          available: parseInt(p.high) - parseInt(p.low)
        }))
      }
    });

  } catch (error) {
    console.error('Error consuming messages:', error);
    
    // Cleanup
    try {
      isConsuming = false;
      await consumer.disconnect();
      await admin.disconnect();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to consume messages',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}