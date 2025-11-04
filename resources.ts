/// <reference path="./src/types/harperdb.d.ts" />
import type { Conversation as ConversationType } from './src/types/schema';
import { createClient } from '@deepgram/sdk';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Types for Deepgram word object
interface DeepgramWord {
	word: string;
	start: number;
	end: number;
	punctuated_word?: string;
	speaker?: number;
	confidence?: number;
	speaker_confidence?: number;
}

// Type for JSON transcript speaker turn
interface SpeakerTurn {
	speaker: number;
	start: number;
	end: number;
	text: string;
}

/**
 * Format seconds to HH:MM:SS.mmm timestamp
 */
function formatTimestamp(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Convert JSON transcript to readable text format
 * Format:
 *   HH:MM:SS.mmm --> HH:MM:SS.mmm
 *   Speaker N
 *   
 *   Text content
 */
function createReadableTranscript(jsonTranscript: SpeakerTurn[]): string {
	if (!jsonTranscript || jsonTranscript.length === 0) {
		return '';
	}

	const parts: string[] = [];

	for (const turn of jsonTranscript) {
		const startTimestamp = formatTimestamp(turn.start);
		const endTimestamp = formatTimestamp(turn.end);
		const timestampLine = `${startTimestamp} --> ${endTimestamp}`;
		const speakerLine = `Speaker ${turn.speaker}`;
		const textContent = turn.text.trim();

		// Format: timestamp\nspeaker\n\ntext\n
		parts.push(`${timestampLine}\n${speakerLine}\n\n${textContent}\n`);
	}

	return parts.join('\n').trim();
}

/**
 * Convert word-level transcript to JSON transcript with speaker turns
 * Groups consecutive words by speaker, creating new turns when:
 * - Speaker changes
 * - Gap between words exceeds threshold
 */
function createJsonTranscript(words: DeepgramWord[], gap: number = 0.8): SpeakerTurn[] {
	if (!words || words.length === 0) {
		return [];
	}

	const turns: SpeakerTurn[] = [];
	let currentTurn: {
		speaker: number;
		start: number;
		text: string;
		lastEnd: number;
	} | null = null;

	for (const word of words) {
		const speaker = word.speaker ?? 0; // Default to speaker 0 if not provided
		const shouldStartNewTurn =
			currentTurn === null ||
			speaker !== currentTurn.speaker ||
			word.start - currentTurn.lastEnd > gap;

		if (shouldStartNewTurn) {
			// Save previous turn
			if (currentTurn !== null) {
				turns.push({
					speaker: currentTurn.speaker,
					start: currentTurn.start,
					end: currentTurn.lastEnd,
					text: currentTurn.text,
				});
			}

			// Start new turn
			currentTurn = {
				speaker: speaker,
				start: word.start,
				text: word.punctuated_word || word.word,
				lastEnd: word.end,
			};
		} else {
			// Add to current turn
			currentTurn.text += ' ' + (word.punctuated_word || word.word);
			currentTurn.lastEnd = word.end;
		}
	}

	// Save final turn
	if (currentTurn !== null) {
		turns.push({
			speaker: currentTurn.speaker,
			start: currentTurn.start,
			end: currentTurn.lastEnd,
			text: currentTurn.text,
		});
	}

	return turns;
}

// Backend configuration from environment variables
// Shared config: Read from VITE_* vars (same as frontend)
const AWS_REGION = process.env.VITE_AWS_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.VITE_S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.VITE_S3_SECRET_ACCESS_KEY;
const S3_CONVOS_BUCKET_NAME = process.env.VITE_S3_CONVOS_BUCKET_NAME;


// Backend-only secrets: No VITE_ prefix
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Validate required environment variables
if (!DEEPGRAM_API_KEY) {
	console.warn('⚠️ Missing environment variable: DEEPGRAM_API_KEY (transcription will not work)');
}
if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
	console.warn('⚠️ Missing environment variables: VITE_S3_ACCESS_KEY_ID, VITE_S3_SECRET_ACCESS_KEY (S3 operations will not work)');
}

// Lazy initialize clients only when needed
let deepgram: ReturnType<typeof createClient> | null = null;
function getDeepgramClient() {
	if (!deepgram && DEEPGRAM_API_KEY) {
		deepgram = createClient(DEEPGRAM_API_KEY);
	}
	return deepgram;
}

let s3Client: S3Client | null = null;
function getS3Client() {
	if (!s3Client && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) {
		s3Client = new S3Client({
			region: AWS_REGION,
			credentials: {
				accessKeyId: S3_ACCESS_KEY_ID,
				secretAccessKey: S3_SECRET_ACCESS_KEY,
			},
		});
	}
	return s3Client;
}

// Custom resource handler for Conversation table
export class Conversation extends tables.Conversation {
	// Handle POST requests to insert conversations
	async post(content: ConversationType): Promise<ConversationType> {
		return super.post(content);
	}
	
	// Handle PUT requests to upsert conversations
	async put(content: ConversationType): Promise<ConversationType> {
		return super.put(content);
	}
	
	// Handle GET requests
	async get(request: any): Promise<ConversationType | ConversationType[]> {
		return super.get(request);
	}
}

// Example greeting endpoint
export class Greeting extends Resource {
	static loadAsInstance = false;

	get(): { greeting: string } {
		return { greeting: 'Hello, world!' };
	}
}

// Generate pre-signed upload URL endpoint
// Usage: POST /GenerateUploadUrl with body { conversationId: "conv-123", fileName: "video.mp4" }
export class GenerateUploadUrl extends Resource {
	static loadAsInstance = true;

	async post(body: { conversationId: string; fileName: string }): Promise<{ uploadUrl: string; s3Key: string }> {
		console.log('🔗 GenerateUploadUrl received body:', JSON.stringify(body, null, 2));
		
		const { conversationId, fileName } = body;

		try {
			const s3 = getS3Client();
			if (!s3) {
				throw new Error('S3 client not initialized. Check AWS credentials in environment variables.');
			}

			// Generate S3 key
			const s3Key = `${conversationId}/${fileName}`;
			
			// Create pre-signed upload URL (valid for 1 hour)
			const putObjectCommand = new PutObjectCommand({
				Bucket: S3_CONVOS_BUCKET_NAME,
				Key: s3Key,
				ContentType: 'video/mp4',
			});
			
			const uploadUrl = await getSignedUrl(s3, putObjectCommand, { expiresIn: 3600 });
			console.log(`✅ Generated upload URL for ${s3Key}`);

			return {
				uploadUrl,
				s3Key,
			};
		} catch (error: any) {
			console.error('❌ Failed to generate upload URL:', error);
			throw new Error(`Failed to generate upload URL: ${error.message}`);
		}
	}
}

// Process transcript endpoint
// Usage: POST /ProcessTranscript with body { conversationId: "conv-123", s3VideoKey: "conv-123/video.mp4" }
export class ProcessTranscript extends Resource {
	// loadAsInstance = true means HarperDB will parse the body and pass it to post()
	static loadAsInstance = true;

	async post(body: { conversationId: string; s3VideoKey: string }): Promise<{ success: boolean; message: string }> {
		console.log('📥 ProcessTranscript received body:', JSON.stringify(body, null, 2));
		
		const { conversationId, s3VideoKey } = body;

		try {
			console.log(`🎙️ Starting transcription for conversation: ${conversationId}`);

			// 1. Generate pre-signed URL for the S3 video file
			console.log('🔗 Generating pre-signed URL for S3 video...');
			const s3 = getS3Client();
			if (!s3) {
				throw new Error('S3 client not initialized. Check AWS credentials in environment variables.');
			}
			const getObjectCommand = new GetObjectCommand({
				Bucket: S3_CONVOS_BUCKET_NAME,
				Key: s3VideoKey,
			});
			const presignedUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
			console.log('✅ Pre-signed URL generated');

			// 2. Call Deepgram API to transcribe the video
			console.log('🎤 Calling Deepgram API...');
			const dgClient = getDeepgramClient();
			if (!dgClient) {
				throw new Error('Deepgram client not initialized. Check DEEPGRAM_API_KEY environment variable.');
			}
			const { result, error } = await dgClient.listen.prerecorded.transcribeUrl(
				{ url: presignedUrl },
				{
					smart_format: true,
					utterances: true,
					punctuate: true,
					diarize: true,
				}
			);

			if (error) {
				throw new Error(`Deepgram error: ${error.message}`);
			}

			console.log('✅ Deepgram transcription complete');

			// 3. Extract word-level transcript from Deepgram response
			// Path: result.results.channels[0].alternatives[0].words
			const wordLevelTranscript = result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
			
			if (!wordLevelTranscript || wordLevelTranscript.length === 0) {
				throw new Error('No word-level transcript found in Deepgram response');
			}
			
			console.log(`📊 Extracted ${wordLevelTranscript.length} words from transcript`);

			// 4. Create JSON transcript from word-level transcript
			console.log('📝 Creating JSON transcript...');
			const jsonTranscript = createJsonTranscript(wordLevelTranscript);
			console.log(`✅ Created ${jsonTranscript.length} speaker turns`);

			// 5. Create readable transcript from JSON transcript
			console.log('📝 Creating readable transcript...');
			const readableTranscript = createReadableTranscript(jsonTranscript);
			console.log(`✅ Created readable transcript`);

			// 6. Upload all three transcripts to S3 in parallel
			console.log('☁️ Uploading transcripts to S3...');
			const wordLevelKey = `${conversationId}/word_level_transcript.json`;
			const jsonTranscriptKey = `${conversationId}/json_transcript.json`;
			const readableTranscriptKey = `${conversationId}/readable_transcript.txt`;

			await Promise.all([
				s3!.send(new PutObjectCommand({
					Bucket: S3_CONVOS_BUCKET_NAME,
					Key: wordLevelKey,
					Body: JSON.stringify(wordLevelTranscript, null, 2),
					ContentType: 'application/json',
				})),
				s3!.send(new PutObjectCommand({
					Bucket: S3_CONVOS_BUCKET_NAME,
					Key: jsonTranscriptKey,
					Body: JSON.stringify(jsonTranscript, null, 2),
					ContentType: 'application/json',
				})),
				s3!.send(new PutObjectCommand({
					Bucket: S3_CONVOS_BUCKET_NAME,
					Key: readableTranscriptKey,
					Body: readableTranscript,
					ContentType: 'text/plain',
				})),
			]);

			console.log(`✅ Transcripts uploaded:`);
			console.log(`   📄 Word-level: s3://${S3_CONVOS_BUCKET_NAME}/${wordLevelKey}`);
			console.log(`   💬 JSON: s3://${S3_CONVOS_BUCKET_NAME}/${jsonTranscriptKey}`);
			console.log(`   📖 Readable: s3://${S3_CONVOS_BUCKET_NAME}/${readableTranscriptKey}`);

			// 7. Update conversation record with transcript S3 keys and mark as succeeded
			console.log('💾 Updating conversation record...');
			const s3KeyPrefix = `s3://${S3_CONVOS_BUCKET_NAME}/`;
			
			const updateResponse = await fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Conversation/${conversationId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					convo_word_transcript_s3_link: s3KeyPrefix + wordLevelKey,
					convo_json_transcript_s3_link: s3KeyPrefix + jsonTranscriptKey,
					convo_readable_transcript_s3_link: s3KeyPrefix + readableTranscriptKey,
					status: 'succeeded', // Terminal state: video + all transcripts complete
				}),
			});

			if (!updateResponse.ok) {
				throw new Error(`Failed to update conversation record: ${updateResponse.statusText}`);
			}

			console.log('✅ Conversation record updated with status: succeeded');

			return {
				success: true,
				message: `Transcription complete for ${conversationId}`,
			};

		} catch (error: any) {
			console.error(`❌ Transcription failed for ${conversationId}:`, error);

			// Update conversation status to failed (terminal state)
			try {
				await fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Conversation/${conversationId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						status: 'failed',
					}),
				});
				console.log('💾 Conversation status updated to: failed');
			} catch (updateError) {
				console.error('Failed to update conversation status:', updateError);
			}

			return {
				success: false,
				message: `Transcription failed: ${error.message}`,
			};
		}
	}
}