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
    id: 'conv-1762362893983',
    convo_title: 'Sales Guru Sales Call',
    convo_video_s3_link: 's3://convoiq-convos-local/conv-1762362893983/video.mp4',
    convo_thumbnail_s3_link: 's3://convoiq-convos-local/conv-1762362893983/thumbnail.webp',
    convo_word_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362893983/word_level_transcript.json',
    convo_readable_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362893983/readable_transcript.txt',
    convo_json_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362893983/json_transcript.json',
    video_duration_seconds: 1135.344,
    word_count: 3310,
    char_count: 13819,
    num_speakers: 2,
    status: 'succeeded',
    createdAt: new Date('2025-11-05T17:14:53.992Z').toISOString()
  },
  {
    id: 'conv-1762362919912',
    convo_title: 'Max Miguel AI Marketing Deal',
    convo_video_s3_link: 's3://convoiq-convos-local/conv-1762362919912/video.mp4',
    convo_thumbnail_s3_link: 's3://convoiq-convos-local/conv-1762362919912/thumbnail.webp',
    convo_word_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362919912/word_level_transcript.json',
    convo_readable_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362919912/readable_transcript.txt',
    convo_json_transcript_s3_link: 's3://convoiq-convos-local/conv-1762362919912/json_transcript.json',
    video_duration_seconds: 2670.5,
    word_count: 9182,
    char_count: 38820,
    num_speakers: 2,
    status: 'succeeded',
    createdAt: new Date('2025-11-05T17:15:19.930Z').toISOString()
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

export async function seedConversations(): Promise<void> {
  console.log('💬 Seeding conversations...\n');

  try {
    // Insert conversations (HarperDB will update if same ID exists)
    for (const convo of conversations) {
      console.log(`📝 Seeding conversation: "${convo.convo_title}"`);
      
      await upsertConversation(convo);
      
      console.log(`  ✅ Conversation "${convo.convo_title}" seeded successfully`);
    }

    console.log(`\n✨ Seeded ${conversations.length} conversation(s)!`);

  } catch (error) {
    console.error('❌ Error seeding conversations:', (error as Error).message);
    console.error('Full error:', error);
    throw error;
  }
}

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedConversations()
    .then(() => {
      console.log('💡 You can run this script again anytime - it\'s idempotent!\n');
    })
    .catch(() => {
      process.exit(1);
    });
}

