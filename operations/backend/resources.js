/// <reference path="../src/types/harperdb.d.ts" />
import { createClient } from '@deepgram/sdk';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { OpenRouter } from '@openrouter/sdk';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
/**
 * Format seconds to HH:MM:SS.mmm timestamp
 */
function formatTimestamp(seconds) {
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
function createReadableTranscript(jsonTranscript) {
    if (!jsonTranscript || jsonTranscript.length === 0) {
        return '';
    }
    const parts = [];
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
function createJsonTranscript(words, gap = 0.8) {
    if (!words || words.length === 0) {
        return [];
    }
    const turns = [];
    let currentTurn = null;
    for (const word of words) {
        const speaker = word.speaker ?? 0; // Default to speaker 0 if not provided
        const shouldStartNewTurn = currentTurn === null ||
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
        }
        else if (currentTurn !== null) {
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
/**
 * Calculate metadata from word-level transcript and readable text
 */
function calculateTranscriptMetadata(words, readableText) {
    if (!words || words.length === 0) {
        return { wordCount: 0, charCount: 0, numSpeakers: 0, duration: 0 };
    }
    const wordCount = words.length;
    // Count characters excluding whitespace, timestamps, and speaker labels
    // We only count the actual spoken text
    const charCount = readableText
        .split('\n')
        .filter(line => !line.includes('-->') && !line.startsWith('Speaker'))
        .join('')
        .replace(/\s/g, '')
        .length;
    const speakers = new Set(words.map(w => w.speaker ?? 0));
    const numSpeakers = speakers.size;
    const duration = words[words.length - 1]?.end || 0;
    return { wordCount, charCount, numSpeakers, duration };
}
/**
 * Generate thumbnail from video using ffmpeg
 * Extracts a frame from the middle of the video (or at specified timestamp)
 * Uses WebP format for better compression (25-35% smaller than JPEG)
 */
async function generateThumbnail(videoUrl, outputPath, timestamp) {
    return new Promise((resolve, reject) => {
        ffmpeg(videoUrl)
            .seekInput(timestamp)
            .outputOptions([
            '-frames:v', '1',
            '-vf', 'scale=1280:720',
            '-quality', '80' // WebP quality (0-100, higher is better)
        ])
            .output(join(outputPath, 'thumbnail.webp'))
            .on('end', () => resolve())
            .on('error', (err) => reject(err))
            .run();
    });
}
/**
 * Get video duration using ffmpeg probe
 */
async function getVideoDuration(videoUrl) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoUrl, (err, metadata) => {
            if (err) {
                reject(err);
            }
            else {
                const duration = metadata.format.duration || 0;
                resolve(duration);
            }
        });
    });
}
// Backend configuration from environment variables
// Backend-only secrets: No VITE_ prefix (not exposed to frontend)
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Shared config: Frontend can see these (VITE_ prefix)
const S3_CONVOS_BUCKET_NAME = process.env.VITE_S3_CONVOS_BUCKET_NAME;
// Validate required environment variables
if (!DEEPGRAM_API_KEY) {
    console.warn('⚠️ Missing environment variable: DEEPGRAM_API_KEY (transcription will not work)');
}
if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    console.warn('⚠️ Missing environment variables: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (S3 operations will not work)');
}
if (!OPENROUTER_API_KEY) {
    console.warn('⚠️ Missing environment variable: OPENROUTER_API_KEY (AI title generation will not work)');
}
// Lazy initialize clients only when needed
let deepgram = null;
function getDeepgramClient() {
    if (!deepgram && DEEPGRAM_API_KEY) {
        deepgram = createClient(DEEPGRAM_API_KEY);
    }
    return deepgram;
}
let s3Client = null;
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
let openRouterClient = null;
function getOpenRouterClient() {
    if (!openRouterClient && OPENROUTER_API_KEY) {
        openRouterClient = new OpenRouter({
            apiKey: OPENROUTER_API_KEY,
        });
    }
    return openRouterClient;
}
/**
 * Create a Server-Sent Events (SSE) stream
 * Allows streaming data to the client in real-time
 */
function createSSEStream(callback) {
    return new ReadableStream({
        async start(controller) {
            const send = (event, data) => {
                const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(new TextEncoder().encode(message));
            };
            try {
                await callback(send);
                controller.close();
            }
            catch (error) {
                send('error', { message: error.message });
                controller.close();
            }
        }
    });
}
// Example greeting endpoint
export class Greeting extends Resource {
    static loadAsInstance = false;
    get() {
        return { greeting: 'Hello, world!' };
    }
}
// Generate pre-signed URL for viewing S3 objects (e.g., thumbnails)
// Usage: GET /GetViewUrl?key=conv-123/thumbnail.jpg
export class GetViewUrl extends Resource {
    static loadAsInstance = false;
    async get(request) {
        const url = new URL(request.url, 'http://localhost');
        const s3Key = url.searchParams.get('key');
        if (!s3Key) {
            throw new Error('Missing required parameter: key');
        }
        try {
            const s3 = getS3Client();
            if (!s3) {
                throw new Error('S3 client not initialized. Check AWS credentials in environment variables.');
            }
            // Create pre-signed view URL (valid for 1 hour)
            const getObjectCommand = new GetObjectCommand({
                Bucket: S3_CONVOS_BUCKET_NAME,
                Key: s3Key,
            });
            const viewUrl = await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
            return { viewUrl };
        }
        catch (error) {
            console.error('❌ Failed to generate view URL:', error);
            throw new Error(`Failed to generate view URL: ${error.message}`);
        }
    }
}
// Generate pre-signed upload URL endpoint
// Usage: POST /GenerateUploadUrl with body { conversationId: "conv-123", fileName: "video.mp4" }
export class GenerateUploadUrl extends Resource {
    static loadAsInstance = true;
    async post(body) {
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
        }
        catch (error) {
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
    async post(body) {
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
            // 2. Get video duration and generate thumbnail
            console.log('🎬 Getting video metadata...');
            let videoDuration = 0;
            let thumbnailS3Key = '';
            try {
                videoDuration = await getVideoDuration(presignedUrl);
                console.log(`✅ Video duration: ${videoDuration.toFixed(2)}s`);
                // Extract thumbnail from middle of video (or 2 seconds in if video is too short)
                const thumbnailTimestamp = videoDuration > 4 ? videoDuration / 2 : Math.min(2, videoDuration / 2);
                console.log(`📸 Extracting thumbnail at ${thumbnailTimestamp.toFixed(2)}s...`);
                // Create temp directory for thumbnail
                const tempDir = join(tmpdir(), `convoiq-${conversationId}`);
                await fs.mkdir(tempDir, { recursive: true });
                // Generate thumbnail
                await generateThumbnail(presignedUrl, tempDir, thumbnailTimestamp);
                console.log('✅ Thumbnail generated');
                // Upload thumbnail to S3
                const thumbnailPath = join(tempDir, 'thumbnail.webp');
                const thumbnailBuffer = await fs.readFile(thumbnailPath);
                thumbnailS3Key = `${conversationId}/thumbnail.webp`;
                await s3.send(new PutObjectCommand({
                    Bucket: S3_CONVOS_BUCKET_NAME,
                    Key: thumbnailS3Key,
                    Body: thumbnailBuffer,
                    ContentType: 'image/webp',
                }));
                console.log(`✅ Thumbnail uploaded to S3: ${thumbnailS3Key}`);
                // Clean up temp directory
                await fs.rm(tempDir, { recursive: true, force: true });
            }
            catch (thumbnailError) {
                console.warn(`⚠️ Thumbnail generation failed (continuing anyway): ${thumbnailError.message}`);
            }
            // 3. Call Deepgram API to transcribe the video
            console.log('🎤 Calling Deepgram API...');
            const dgClient = getDeepgramClient();
            if (!dgClient) {
                throw new Error('Deepgram client not initialized. Check DEEPGRAM_API_KEY environment variable.');
            }
            const { result, error } = await dgClient.listen.prerecorded.transcribeUrl({ url: presignedUrl }, {
                smart_format: true,
                utterances: true,
                punctuate: true,
                diarize: true,
            });
            if (error) {
                throw new Error(`Deepgram error: ${error.message}`);
            }
            console.log('✅ Deepgram transcription complete');
            // 4. Extract word-level transcript from Deepgram response
            // Path: result.results.channels[0].alternatives[0].words
            const wordLevelTranscript = result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
            if (!wordLevelTranscript || wordLevelTranscript.length === 0) {
                throw new Error('No word-level transcript found in Deepgram response');
            }
            console.log(`📊 Extracted ${wordLevelTranscript.length} words from transcript`);
            // 5. Create JSON transcript from word-level transcript
            console.log('📝 Creating JSON transcript...');
            const jsonTranscript = createJsonTranscript(wordLevelTranscript);
            console.log(`✅ Created ${jsonTranscript.length} speaker turns`);
            // 6. Create readable transcript from JSON transcript
            console.log('📝 Creating readable transcript...');
            const readableTranscript = createReadableTranscript(jsonTranscript);
            console.log(`✅ Created readable transcript`);
            // 7. Calculate metadata from transcript (needs readable text for char count)
            console.log('📊 Calculating transcript metadata...');
            const metadata = calculateTranscriptMetadata(wordLevelTranscript, readableTranscript);
            console.log(`✅ Metadata: ${metadata.wordCount} words, ${metadata.charCount} chars, ${metadata.numSpeakers} speakers, ${metadata.duration.toFixed(2)}s`);
            // Use transcript duration if video duration wasn't available
            if (videoDuration === 0) {
                videoDuration = metadata.duration;
            }
            // 8. Upload all three transcripts to S3 in parallel
            console.log('☁️ Uploading transcripts to S3...');
            const wordLevelKey = `${conversationId}/word_level_transcript.json`;
            const jsonTranscriptKey = `${conversationId}/json_transcript.json`;
            const readableTranscriptKey = `${conversationId}/readable_transcript.txt`;
            await Promise.all([
                s3.send(new PutObjectCommand({
                    Bucket: S3_CONVOS_BUCKET_NAME,
                    Key: wordLevelKey,
                    Body: JSON.stringify(wordLevelTranscript, null, 2),
                    ContentType: 'application/json',
                })),
                s3.send(new PutObjectCommand({
                    Bucket: S3_CONVOS_BUCKET_NAME,
                    Key: jsonTranscriptKey,
                    Body: JSON.stringify(jsonTranscript, null, 2),
                    ContentType: 'application/json',
                })),
                s3.send(new PutObjectCommand({
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
            // 9. Update conversation record with all data and mark as succeeded
            console.log('💾 Updating conversation record...');
            const s3KeyPrefix = `s3://${S3_CONVOS_BUCKET_NAME}/`;
            const updateData = {
                convo_word_transcript_s3_link: s3KeyPrefix + wordLevelKey,
                convo_json_transcript_s3_link: s3KeyPrefix + jsonTranscriptKey,
                convo_readable_transcript_s3_link: s3KeyPrefix + readableTranscriptKey,
                video_duration_seconds: videoDuration,
                word_count: metadata.wordCount,
                char_count: metadata.charCount,
                num_speakers: metadata.numSpeakers,
                status: 'succeeded', // Terminal state: video + all transcripts complete
            };
            // Add thumbnail if it was successfully generated
            if (thumbnailS3Key) {
                updateData.convo_thumbnail_s3_link = s3KeyPrefix + thumbnailS3Key;
            }
            const updateResponse = await fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Conversation/${conversationId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updateData),
            });
            if (!updateResponse.ok) {
                throw new Error(`Failed to update conversation record: ${updateResponse.statusText}`);
            }
            console.log('✅ Conversation record updated with status: succeeded');
            return {
                success: true,
                message: `Transcription complete for ${conversationId}`,
            };
        }
        catch (error) {
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
            }
            catch (updateError) {
                console.error('Failed to update conversation status:', updateError);
            }
            return {
                success: false,
                message: `Transcription failed: ${error.message}`,
            };
        }
    }
}
// Generate component title using AI
// Usage: POST /GenerateComponentTitle with body { prompt: string, structuredOutput: string, uiCode: string }
export class GenerateComponentTitle extends Resource {
    static loadAsInstance = true;
    async post(body) {
        console.log('✨ GenerateComponentTitle received request');
        const { prompt, structuredOutput, uiCode } = body;
        try {
            if (!OPENROUTER_API_KEY) {
                throw new Error('OPENROUTER_API_KEY not set in environment variables.');
            }
            // Import title generator
            const { generateComponentTitle } = await import('./title-generators.js');
            // Generate title using extracted function (now using API key directly)
            return await generateComponentTitle(OPENROUTER_API_KEY, prompt, structuredOutput, uiCode);
        }
        catch (error) {
            console.error('❌ Failed to generate component title:', error);
            throw new Error(`Failed to generate title: ${error.message}`);
        }
    }
}
// Generate conversation title using AI
// Usage: POST /GenerateConversationTitle with body { conversationId: string }
export class GenerateConversationTitle extends Resource {
    static loadAsInstance = true;
    async post(body) {
        console.log('✨ GenerateConversationTitle received request');
        const { conversationId } = body;
        try {
            if (!OPENROUTER_API_KEY) {
                throw new Error('OPENROUTER_API_KEY not set in environment variables.');
            }
            const s3 = getS3Client();
            if (!s3) {
                throw new Error('S3 client not initialized. Check AWS credentials in environment variables.');
            }
            // 1. Fetch conversation from database
            console.log(`📥 Fetching conversation: ${conversationId}`);
            const conversationResponse = await fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Conversation/${conversationId}`);
            if (!conversationResponse.ok) {
                throw new Error(`Failed to fetch conversation: ${conversationResponse.statusText}`);
            }
            const conversation = await conversationResponse.json();
            if (!conversation.convo_readable_transcript_s3_link) {
                throw new Error('No readable transcript found for this conversation');
            }
            // 2. Get readable transcript from S3
            console.log('📄 Fetching readable transcript from S3...');
            const s3Key = conversation.convo_readable_transcript_s3_link.replace(`s3://${S3_CONVOS_BUCKET_NAME}/`, '');
            const getObjectCommand = new GetObjectCommand({
                Bucket: S3_CONVOS_BUCKET_NAME,
                Key: s3Key,
            });
            const s3Response = await s3.send(getObjectCommand);
            const readableTranscript = await s3Response.Body?.transformToString();
            if (!readableTranscript) {
                throw new Error('Failed to read transcript from S3');
            }
            console.log(`📊 Transcript length: ${readableTranscript.length} characters`);
            // 3. Generate title using full transcript (now using API key directly)
            const { generateConversationTitle } = await import('./title-generators.js');
            return await generateConversationTitle(OPENROUTER_API_KEY, readableTranscript);
        }
        catch (error) {
            console.error('❌ Failed to generate conversation title:', error);
            throw new Error(`Failed to generate title: ${error.message}`);
        }
    }
}
// Format dashboard title with timestamp
function formatDashboardTitle(createdAt) {
    const date = new Date(createdAt);
    const options = {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    };
    const formatted = date.toLocaleString('en-US', options);
    return `Dashboard - ${formatted}`;
}
// Generate dashboard title using AI
// Usage: POST /GenerateDashboardTitle with body { dashboardId: string }
export class GenerateDashboardTitle extends Resource {
    static loadAsInstance = true;
    async post(body) {
        console.log('✨ GenerateDashboardTitle received request');
        const { dashboardId } = body;
        try {
            if (!OPENROUTER_API_KEY) {
                throw new Error('OPENROUTER_API_KEY not set in environment variables.');
            }
            // 1. Fetch dashboard from database
            console.log(`📥 Fetching dashboard: ${dashboardId}`);
            const dashboardResponse = await fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Dashboard/${dashboardId}`);
            if (!dashboardResponse.ok) {
                throw new Error(`Failed to fetch dashboard: ${dashboardResponse.statusText}`);
            }
            const dashboard = await dashboardResponse.json();
            // Parse layout if it's a string
            const layout = typeof dashboard.layout === 'string'
                ? JSON.parse(dashboard.layout)
                : dashboard.layout;
            // Check if dashboard is empty - generate timestamp-based title
            if (!layout || layout.length === 0) {
                const title = formatDashboardTitle(dashboard.createdAt);
                console.log(`✅ Generated title for empty dashboard: "${title}"`);
                return {
                    thinking: 'Dashboard has no components - using creation timestamp',
                    title: title
                };
            }
            // 2. Extract component IDs from layout
            const componentIds = layout.map((item) => item.componentId);
            console.log(`📊 Found ${componentIds.length} components in dashboard`);
            // 3. Fetch all components in parallel
            console.log('📥 Fetching component details...');
            const componentPromises = componentIds.map((id) => fetch(`${process.env.VITE_HARPERDB_URL || 'http://localhost:9926'}/Component/${id}`)
                .then(res => res.ok ? res.json() : null)
                .catch(() => null));
            const components = await Promise.all(componentPromises);
            // 4. Extract component titles, filtering out null/failed fetches
            const componentTitles = components
                .filter(c => c !== null && c.component_title)
                .map(c => c.component_title);
            if (componentTitles.length === 0) {
                throw new Error('No valid components found in dashboard');
            }
            console.log(`✅ Retrieved ${componentTitles.length} component titles`);
            // 5. Generate title using component titles (now using API key directly)
            const { generateDashboardTitle } = await import('./title-generators.js');
            return await generateDashboardTitle(OPENROUTER_API_KEY, componentTitles);
        }
        catch (error) {
            console.error('❌ Failed to generate dashboard title:', error);
            throw new Error(`Failed to generate title: ${error.message}`);
        }
    }
}
// Agent endpoint for component editing
export class RunAgent extends Resource {
    static loadAsInstance = true;
    async post(body) {
        console.log('🤖 RunAgent received request (streaming mode)');
        const { componentId, componentTitle, conversationId, conversationTitle, userPrompt, currentState, editModes } = body;
        // Create SSE stream for real-time updates
        const stream = createSSEStream(async (send) => {
            try {
                const client = getOpenRouterClient();
                if (!client) {
                    throw new Error('OpenRouter client not initialized. Check OPENROUTER_API_KEY environment variable.');
                }
                // Import agent modules
                const { AGENT_SYSTEM_PROMPT, buildAgentUserPrompt } = await import('./agent-prompts.js');
                const { getAgentTools, AgentToolHandler } = await import('./agent-tools.js');
                // Create component object from current frontend state
                const component = {
                    id: componentId,
                    component_title: componentTitle,
                    component_type: 'llm',
                    prompt: currentState.prompt,
                    code: '',
                    structuredOutput: currentState.structuredOutput,
                    uiCode: currentState.uiCode,
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                };
                console.log(`🤖 Using current state from frontend (not database)`);
                // Initialize tool handler
                const harperdbUrl = process.env.VITE_HARPERDB_URL || 'http://localhost:9926';
                const toolHandler = new AgentToolHandler(component, conversationId, harperdbUrl);
                // Get tools based on enabled edit modes
                const agentTools = getAgentTools(editModes);
                // Fetch conversation metadata
                let conversationMetadata;
                try {
                    const conversationResponse = await fetch(`${harperdbUrl}/Conversation/${conversationId}`);
                    if (conversationResponse.ok) {
                        const conversation = await conversationResponse.json();
                        conversationMetadata = {
                            durationMinutes: conversation.video_duration_seconds
                                ? (conversation.video_duration_seconds / 60).toFixed(1)
                                : undefined,
                            wordCount: conversation.word_count,
                            charCount: conversation.char_count,
                            speakers: conversation.num_speakers,
                        };
                    }
                }
                catch (error) {
                    console.warn('⚠️ Could not fetch conversation metadata:', error);
                }
                // Build agent prompt
                const agentUserPrompt = buildAgentUserPrompt({
                    userInput: userPrompt,
                    componentTitle,
                    currentState,
                    editModes,
                    conversationTitle,
                    conversationMetadata,
                });
                console.log('🤖 Starting agent conversation...');
                // Agent loop
                const messages = [
                    { role: 'system', content: AGENT_SYSTEM_PROMPT },
                    { role: 'user', content: agentUserPrompt },
                ];
                let messageIdCounter = 0;
                let iteration = 0;
                const maxIterations = 25;
                while (iteration < maxIterations) {
                    iteration++;
                    console.log(`🔄 Agent iteration ${iteration}/${maxIterations}`);
                    // Call LLM with streaming enabled
                    // @ts-ignore - SDK types don't include all options yet
                    const completion = await client.chat.send({
                        model: 'anthropic/claude-4.5-sonnet',
                        messages,
                        tools: agentTools,
                        temperature: 0.7,
                        maxTokens: 10000,
                        stream: true, // Enable streaming
                    });
                    // Process streaming response
                    let currentMessageId = `msg-${messageIdCounter++}`;
                    let accumulatedContent = '';
                    let accumulatedToolCalls = [];
                    send('message_start', { messageId: currentMessageId });
                    // Stream text chunks as they arrive
                    for await (const chunk of completion) {
                        const delta = chunk.choices?.[0]?.delta;
                        if (delta?.content) {
                            accumulatedContent += delta.content;
                            send('message_chunk', {
                                messageId: currentMessageId,
                                delta: delta.content,
                            });
                        }
                        // Accumulate tool calls if present in delta
                        const deltaToolCalls = delta?.toolCalls || delta?.tool_calls;
                        if (deltaToolCalls) {
                            for (const deltaToolCall of deltaToolCalls) {
                                const index = deltaToolCall.index;
                                // Initialize tool call at this index if needed
                                if (!accumulatedToolCalls[index]) {
                                    accumulatedToolCalls[index] = {
                                        id: deltaToolCall.id || '',
                                        type: 'function',
                                        function: {
                                            name: '',
                                            arguments: ''
                                        }
                                    };
                                }
                                // Accumulate the tool call pieces
                                if (deltaToolCall.id) {
                                    accumulatedToolCalls[index].id = deltaToolCall.id;
                                }
                                if (deltaToolCall.function?.name) {
                                    accumulatedToolCalls[index].function.name += deltaToolCall.function.name;
                                }
                                if (deltaToolCall.function?.arguments) {
                                    accumulatedToolCalls[index].function.arguments += deltaToolCall.function.arguments;
                                }
                            }
                        }
                    }
                    send('message_complete', {
                        messageId: currentMessageId,
                        content: accumulatedContent
                    });
                    // Build message object for conversation history
                    const message = {
                        role: 'assistant',
                        content: accumulatedContent
                    };
                    // Add tool calls if any were accumulated
                    if (accumulatedToolCalls.length > 0) {
                        message.toolCalls = accumulatedToolCalls.filter(tc => tc !== undefined);
                    }
                    messages.push(message);
                    // Check if agent wants to use tools
                    const toolCalls = message.toolCalls || message.tool_calls;
                    if (toolCalls && toolCalls.length > 0) {
                        console.log(`🔧 Agent is using ${toolCalls.length} tool(s)`);
                        console.log('🔍 Tool calls structure:', JSON.stringify(toolCalls, null, 2));
                        // Execute all tool calls
                        for (const toolCall of toolCalls) {
                            const toolName = toolCall?.function?.name;
                            const toolCallId = toolCall?.id;
                            console.log(`⚙️ Tool: ${toolName}, ID: ${toolCallId}`);
                            let toolArgs;
                            try {
                                toolArgs = JSON.parse(toolCall.function.arguments || '{}');
                            }
                            catch (parseError) {
                                console.error(`❌ Failed to parse tool arguments for ${toolName}:`, parseError.message);
                                const errorResult = {
                                    error: `Failed to parse arguments: ${parseError.message}`,
                                    rawArguments: toolCall.function.arguments
                                };
                                messages.push({
                                    role: 'tool',
                                    toolCallId: toolCallId,
                                    content: JSON.stringify(errorResult),
                                });
                                // Send tool call and error result events
                                send('tool_call', {
                                    id: `tool-${messageIdCounter++}`,
                                    toolName,
                                    args: toolCall.function.arguments,
                                });
                                send('tool_result', {
                                    id: `result-${messageIdCounter++}`,
                                    toolName,
                                    result: errorResult,
                                    success: false,
                                });
                                continue;
                            }
                            // Send tool call event
                            send('tool_call', {
                                id: `tool-${messageIdCounter++}`,
                                toolName,
                                args: toolArgs,
                            });
                            try {
                                const result = await toolHandler.executeTool(toolName, toolArgs);
                                console.log(`✓ Tool ${toolName} completed successfully`);
                                // Add tool result to conversation
                                messages.push({
                                    role: 'tool',
                                    toolCallId: toolCallId,
                                    content: JSON.stringify(result, null, 2),
                                });
                                // Send tool result event
                                send('tool_result', {
                                    id: `result-${messageIdCounter++}`,
                                    toolName,
                                    result,
                                    success: true,
                                });
                            }
                            catch (error) {
                                console.error(`❌ Tool execution failed for ${toolName}:`, error.message);
                                const errorResult = { error: error.message };
                                messages.push({
                                    role: 'tool',
                                    toolCallId: toolCallId,
                                    content: JSON.stringify(errorResult),
                                });
                                // Send error result event
                                send('tool_result', {
                                    id: `result-${messageIdCounter++}`,
                                    toolName,
                                    result: errorResult,
                                    success: false,
                                });
                            }
                        }
                        // Continue conversation loop
                        continue;
                    }
                    // No more tool calls - agent is done
                    console.log('✅ Agent conversation complete');
                    break;
                }
                if (iteration >= maxIterations) {
                    console.warn('⚠️ Agent reached max iterations');
                    send('error', {
                        message: 'Agent reached maximum iterations. Check the component for partial changes.',
                    });
                }
                // Get the updated component state
                const updatedComponent = toolHandler.getCurrentComponent();
                // Send final completion event
                send('agent_complete', {
                    success: true,
                    updatedState: {
                        prompt: updatedComponent.prompt || '',
                        structuredOutput: updatedComponent.structuredOutput || '',
                        uiCode: updatedComponent.uiCode || '',
                    },
                });
            }
            catch (error) {
                console.error('❌ Agent execution failed:', error);
                send('error', {
                    message: error.message,
                });
            }
        });
        // Return SSE stream response
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }
}
