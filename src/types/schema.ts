// TypeScript types matching schema.graphql
// This ensures type safety across your application

// Status flow: uploading → succeeded (terminal) or failed (terminal)
// succeeded = video + all 3 transcripts uploaded to S3
export type ConversationStatus = 'uploading' | 'succeeded' | 'failed';

export interface Conversation {
  id: string;
  convo_title: string;
  convo_video_s3_link: string;
  convo_thumbnail_s3_link?: string;
  convo_word_transcript_s3_link: string;
  convo_readable_transcript_s3_link: string;
  convo_json_transcript_s3_link: string;
  video_duration_seconds?: number;
  word_count?: number;
  char_count?: number;
  num_speakers?: number;
  status: ConversationStatus;
  createdAt: string; // ISO 8601 date string
}

// Helper type for creating new conversations (without auto-generated fields)
export type NewConversation = Conversation;

// Component types
export type ComponentType = 'llm' | 'code';
export type ComponentStatus = 'draft' | 'published';

export interface Component {
  id: string;
  component_title: string;     // Matches schema.graphql
  component_type: ComponentType;
  prompt: string;              // Used by LLM components
  code: string;                // Used by code components
  structuredOutput: string;    // JSON schema for output structure
  uiCode: string;              // React component code (uses Tailwind)
  status: ComponentStatus;     // draft or published
  createdAt: string;           // ISO 8601 date string
}

// Dashboard types
export type DashboardStatus = 'draft' | 'published';

export interface DashboardComponentLayout {
  componentId: string;         // Reference to Component.id
  x: number;                   // X coordinate (top-left corner)
  y: number;                   // Y coordinate (top-left corner)
  width: number;               // Width in grid units
  height: number;              // Height in grid units
  zIndex?: number;             // Optional z-index for layering
}

export interface Dashboard {
  id: string;
  dashboard_title: string;
  layout: DashboardComponentLayout[];  // Array of component layouts (stored as JSON string in DB)
  status: DashboardStatus;
  createdAt: string;           // ISO 8601 date string
}

