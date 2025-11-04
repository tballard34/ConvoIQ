// TypeScript types matching schema.graphql
// This ensures type safety across your application

// Status flow: uploading → succeeded (terminal) or failed (terminal)
// succeeded = video + all 3 transcripts uploaded to S3
export type ConversationStatus = 'uploading' | 'succeeded' | 'failed';

export interface Conversation {
  id: string;
  convo_title: string;
  convo_video_s3_link: string;
  convo_word_transcript_s3_link: string;
  convo_readable_transcript_s3_link: string;
  convo_json_transcript_s3_link: string;
  status: ConversationStatus;
  createdAt: string; // ISO 8601 date string
}

// Helper type for creating new conversations (without auto-generated fields)
export type NewConversation = Conversation;

// Component types
export type ComponentType = 'llm' | 'code';

export interface Component {
  id: string;
  component_name: string;
  component_type: ComponentType;
  prompt: string;              // Used by LLM components
  code: string;                // Used by code components
  structuredOutput: string;    // JSON schema for output structure
  uiCode: string;              // React component code (uses Tailwind)
  createdAt: string;           // ISO 8601 date string
}

