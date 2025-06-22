import { NextRequest, NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js')

export const dynamic = 'force-dynamic';

interface KafkaMessage {
  key?: string;
  value: any;
  topic: string;
}

async function oauthBearerTokenProvider(region: any) {
   // Uses AWS Default Credentials Provider Chain to fetch credentials
   const authTokenResponse = await generateAuthToken({ region });
   return {
       value: authTokenResponse.token
   }
}

// Kafka configuration
const kafka = new Kafka({
  clientId: 'nextjs-kafka-producer',
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

export async function POST(request: NextRequest) {
  const producer = kafka.producer();

  try {
    const body: KafkaMessage = await request.json();
    const { topic, key, value } = body;

    if (!topic || !value) {
      return NextResponse.json(
        { error: 'Topic and value are required' },
        { status: 400 }
      );
    }

    await producer.connect();

    const message = {
      key: key || null,
      value: JSON.stringify({
        ...value,
        timestamp: Date.now(),
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }),
    };

    const result = await producer.send({
      topic,
      messages: [message],
    });

    await producer.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Message sent successfully',
      metadata: result,
    });

  } catch (error) {
    console.error('Error sending message:', error);
    await producer.disconnect();
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}