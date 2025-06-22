import { NextRequest, NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';
const { generateAuthToken } = require('aws-msk-iam-sasl-signer-js')

export const dynamic = 'force-dynamic';

async function oauthBearerTokenProvider(region: any) {
   const authTokenResponse = await generateAuthToken({ region });
   return {
       value: authTokenResponse.token
   }
}

const kafka = new Kafka({
  clientId: 'nextjs-kafka-admin',
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
  const admin = kafka.admin();

  try {
    await admin.connect();
    
    // List all topics
    const metadata = await admin.fetchTopicMetadata();
    const topics = Object.keys(metadata.topics);
    
    await admin.disconnect();

    return NextResponse.json({
      success: true,
      topics,
      count: topics.length
    });

  } catch (error) {
    console.error('Error fetching topics:', error);
    try {
      await admin.disconnect();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch topics',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}