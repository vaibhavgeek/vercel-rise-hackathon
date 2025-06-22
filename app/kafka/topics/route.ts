import { NextResponse } from 'next/server';
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
  connectionTimeout: 3000, // Shorter timeout
  requestTimeout: 25000,   // Reasonable request timeout
  retry: {
    initialRetryTime: 100,
    retries: 3 // Fewer retries to avoid timeout issues
  }
});

export async function GET() {
  const admin = kafka.admin();

  try {
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();

    return NextResponse.json({
      success: true,
      topics,
    });

  } catch (error) {
    console.error('Error listing topics:', error);
    await admin.disconnect();
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list topics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}