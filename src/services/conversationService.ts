import { config } from '../config';
import type { Conversation } from '../types/schema';

/**
 * Fetch all successfully processed conversations from HarperDB
 */
export async function fetchConversations(): Promise<Conversation[]> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Conversation/`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched conversations:', data);
    
    // Filter to only show conversations with status="succeeded"
    const allConversations = Array.isArray(data) ? data : [];
    return allConversations.filter(convo => convo.status === 'succeeded');
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }
}

/**
 * Upload a video file and create a conversation record
 */
export async function uploadConversation(file: File): Promise<void> {
  console.log('📹 File selected:', file.name);
  console.log('📦 File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

  // Generate conversation ID and use consistent filename
  const conversationId = `conv-${Date.now()}`;
  const originalFileName = file.name.replace('.mp4', '');
  const s3FileName = 'video.mp4'; // Consistent filename, ID provides uniqueness
  
  // 1. Get pre-signed upload URL from backend
  console.log('🔗 Getting pre-signed upload URL...');
  const urlResponse = await fetch(`${config.harperdbUrl}/GenerateUploadUrl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      fileName: s3FileName
    })
  });

  if (!urlResponse.ok) {
    throw new Error(`Failed to get upload URL: ${urlResponse.statusText}`);
  }

  const { uploadUrl, s3Key } = await urlResponse.json();
  console.log('✅ Received pre-signed URL');

  // 2. Create conversation record with status="uploading"
  console.log('📝 Creating conversation record...');
  const bucketName = config.s3ConvosBucketName;
  await fetch(`${config.harperdbUrl}/Conversation/${conversationId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: conversationId,
      convo_title: originalFileName,
      convo_video_s3_link: `s3://${bucketName}/${s3Key}`,
      convo_word_transcript_s3_link: '',
      convo_readable_transcript_s3_link: '',
      convo_json_transcript_s3_link: '',
      status: 'uploading',
      createdAt: new Date().toISOString()
    })
  });

  // 3. Upload directly to S3 using pre-signed URL
  console.log('☁️ Uploading to S3...');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to S3: ${uploadResponse.statusText}`);
  }
  
  console.log('✅ Upload complete!');

  // 4. Trigger transcription workflow (status stays "uploading" until transcripts are complete)
  console.log('🎤 Triggering transcription...');
  
  try {
    const response = await fetch(`${config.harperdbUrl}/ProcessTranscript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        s3VideoKey: s3Key
      })
    });
    
    const result = await response.json();
    console.log('✅ Transcription response:', result);
  } catch (error) {
    console.error('❌ Failed to trigger transcription:', error);
  }
}

/**
 * Fetch a single conversation by ID
 */
export async function fetchConversationById(id: string): Promise<Conversation | null> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Conversation/${id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
}

/**
 * Update a conversation
 */
export async function updateConversation(conversation: Conversation): Promise<void> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Conversation/${conversation.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conversation)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update conversation: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error updating conversation:', error);
    throw error;
  }
}

/**
 * Delete a conversation by ID
 */
export async function deleteConversation(id: string): Promise<void> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Conversation/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }
    
    console.log('Conversation deleted successfully');
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
}

/**
 * Generate a conversation title using AI with a 25-second timeout
 */
export async function generateConversationTitle(
  conversationId: string
): Promise<{ thinking: string; title: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
  
  try {
    const response = await fetch(`${config.harperdbUrl}/GenerateConversationTitle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to generate title: ${response.statusText}`);
    }
    
    const data = await response.json();
    return { thinking: data.thinking, title: data.title };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Title generation timed out after 25 seconds');
    }
    throw error;
  }
}

/**
 * Get a presigned URL for viewing an S3 object (e.g., thumbnail)
 */
export async function getS3ViewUrl(s3Link: string): Promise<string | null> {
  try {
    // Extract S3 key from s3:// link
    // Format: s3://bucket-name/key
    const match = s3Link.match(/s3:\/\/[^/]+\/(.+)/);
    if (!match) {
      console.warn('Invalid S3 link format:', s3Link);
      return null;
    }

    const s3Key = match[1];
    if (!s3Key) {
      console.warn('Empty S3 key extracted from:', s3Link);
      return null;
    }
    
    const response = await fetch(`${config.harperdbUrl}/GetViewUrl?key=${encodeURIComponent(s3Key)}`);
    
    if (!response.ok) {
      console.warn('Failed to get view URL:', response.statusText);
      return null;
    }
    
    const data = await response.json();
    return data.viewUrl;
  } catch (error) {
    console.error('Error getting S3 view URL:', error);
    return null;
  }
}

