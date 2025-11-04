import fetch from 'node-fetch';
import type { Conversation } from '../src/types/schema.js';

// For local dev (npm run dev), use localhost
// The local HarperDB instance runs on port 9926 by default
const HARPERDB_URL = process.env.HARPERDB_URL || 'http://localhost:9926';
const HARPERDB_USERNAME = process.env.HARPERDB_USERNAME || '';
const HARPERDB_PASSWORD = process.env.HARPERDB_PASSWORD || '';

// Mock conversations - add more here as needed
// TypeScript will ensure these match the Conversation schema!
const conversations: Conversation[] = [
  {
    id: 'conv-1762290212822',
    convo_title: 'Sales Guru Sales Call',
    convo_video_s3_link: 's3://convoiq-convos-local/conv-1762290212822/video.mp4',
    convo_word_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290212822/word_level_transcript.json',
    convo_readable_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290212822/readable_transcript.txt',
    convo_json_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290212822/json_transcript.json',
    status: 'succeeded',
    createdAt: new Date('2024-01-15T10:00:00Z').toISOString()
  },
  {
    id: 'conv-1762290363079',
    convo_title: 'Max Miguel AI Marketing Deal',
    convo_video_s3_link: 's3://convoiq-convos-local/conv-1762290363079/video.mp4',
    convo_word_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290363079/word_level_transcript.json',
    convo_readable_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290363079/readable_transcript.txt',
    convo_json_transcript_s3_link: 's3://convoiq-convos-local/conv-1762290363079/json_transcript.json',
    status: 'succeeded',
    createdAt: new Date('2024-01-18T14:30:00Z').toISOString()
  }
];

async function upsertConversation(conversation: Conversation): Promise<{ success: boolean }> {
  // Use HarperDB's REST API to upsert a conversation
  // PUT to /Conversation/{id} for upsert behavior
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  // Only add auth header if credentials are provided
  if (HARPERDB_USERNAME && HARPERDB_PASSWORD) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${HARPERDB_USERNAME}:${HARPERDB_PASSWORD}`).toString('base64');
  }
  
  const response = await fetch(`${HARPERDB_URL}/Conversation/${conversation.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(conversation)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HarperDB error: ${error}`);
  }

  // Handle empty response body (successful PUT may return no content)
  const text = await response.text();
  return text ? JSON.parse(text) : { success: true };
}

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seed...\n');
  console.log(`📡 Connecting to: ${HARPERDB_URL}\n`);

  try {
    // Insert conversations (HarperDB will update if same ID exists)
    for (const convo of conversations) {
      console.log(`📝 Seeding conversation: "${convo.convo_title}"`);
      
      await upsertConversation(convo);
      
      console.log(`  ✅ Conversation "${convo.convo_title}" seeded successfully`);
    }

    console.log(`\n✨ Database seeded with ${conversations.length} conversation(s)!`);
    console.log('💡 You can run this script again anytime - it\'s idempotent!\n');

  } catch (error) {
    console.error('❌ Error seeding database:', (error as Error).message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

seedDatabase();

