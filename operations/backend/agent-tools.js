/**
 * Agent Tools
 *
 * Tools available to the agent for reading/editing components and testing them.
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
// S3 configuration
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_CONVOS_BUCKET_NAME = process.env.VITE_S3_CONVOS_BUCKET_NAME;
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
// Helper to fetch from S3
async function fetchFromS3(s3Url) {
    const s3 = getS3Client();
    if (!s3) {
        throw new Error('S3 client not initialized');
    }
    // Parse s3://bucket/key format
    const match = s3Url.match(/s3:\/\/([^\/]+)\/(.+)/);
    if (!match) {
        throw new Error(`Invalid S3 URL: ${s3Url}`);
    }
    const [, bucket, key] = match;
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    const response = await s3.send(command);
    const str = await response.Body?.transformToString();
    if (!str) {
        throw new Error('Failed to read S3 object');
    }
    return str;
}
/**
 * Tool definitions for the agent
 * Only includes tools that are enabled based on edit modes
 */
export function getAgentTools(editModes) {
    const tools = [
        // Always available: read current component
        {
            type: 'function',
            function: {
                name: 'read_current_component',
                description: 'Read the current state of the component being edited. Returns the prompt, structured output schema, and UI code.',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
            },
        },
        // Always available: get conversation transcript
        {
            type: 'function',
            function: {
                name: 'get_conversation_transcript',
                description: 'Fetch the readable transcript for the selected conversation. Returns transcript with rich metadata (duration, word count, speakers, character count, percentage fetched). Start with a small sample (5000 chars), then request more if needed based on the metadata.',
                parameters: {
                    type: 'object',
                    properties: {
                        max_chars: {
                            type: 'number',
                            description: 'Maximum number of characters to return. Default is 5000. You can peek at the transcript with less character and then request more if needed based on the metadata.',
                        },
                    },
                    required: [],
                },
            },
        },
        // Always available: test component
        {
            type: 'function',
            function: {
                name: 'test_component',
                description: 'Test the current prompt + structured output on the selected conversation transcript. Returns the LLM response or any errors.',
                parameters: {
                    type: 'object',
                    properties: {
                        test_type: {
                            type: 'string',
                            enum: ['full', 'schema_validation', 'ui_render'],
                            description: 'Type of test: full (run LLM + validate), schema_validation (just validate output format), ui_render (check if UI can render)',
                        },
                    },
                    required: ['test_type'],
                },
            },
        },
    ];
    // Conditionally add edit tools based on enabled modes
    if (editModes.editPrompt) {
        tools.push({
            type: 'function',
            function: {
                name: 'edit_prompt',
                description: 'Edit the component prompt.',
                parameters: {
                    type: 'object',
                    properties: {
                        new_prompt: {
                            type: 'string',
                            description: 'The new prompt text',
                        },
                        reasoning: {
                            type: 'string',
                            description: 'Brief explanation of why you made these changes',
                        },
                    },
                    required: ['new_prompt', 'reasoning'],
                },
            },
        });
    }
    if (editModes.editData) {
        tools.push({
            type: 'function',
            function: {
                name: 'edit_structured_output',
                description: 'Edit the structured output JSON schema.',
                parameters: {
                    type: 'object',
                    properties: {
                        new_schema: {
                            type: 'string',
                            description: 'The new JSON schema as a string',
                        },
                        reasoning: {
                            type: 'string',
                            description: 'Brief explanation of why you made these changes',
                        },
                    },
                    required: ['new_schema', 'reasoning'],
                },
            },
        });
    }
    if (editModes.editUICode) {
        tools.push({
            type: 'function',
            function: {
                name: 'edit_ui_code',
                description: 'Edit the React UI component code.',
                parameters: {
                    type: 'object',
                    properties: {
                        new_code: {
                            type: 'string',
                            description: 'The new React component code (TypeScript/JSX)',
                        },
                        reasoning: {
                            type: 'string',
                            description: 'Brief explanation of why you made these changes',
                        },
                    },
                    required: ['new_code', 'reasoning'],
                },
            },
        });
    }
    return tools;
}
/**
 * Tool handler implementations
 */
export class AgentToolHandler {
    component;
    conversationId;
    harperdbUrl;
    constructor(component, conversationId, harperdbUrl) {
        this.component = component;
        this.conversationId = conversationId;
        this.harperdbUrl = harperdbUrl;
    }
    /**
     * Execute a tool call
     */
    async executeTool(toolName, args) {
        switch (toolName) {
            case 'read_current_component':
                return this.readCurrentComponent();
            case 'edit_prompt':
                return this.editPrompt(args.new_prompt, args.reasoning);
            case 'edit_structured_output':
                return this.editStructuredOutput(args.new_schema, args.reasoning);
            case 'edit_ui_code':
                return this.editUICode(args.new_code, args.reasoning);
            case 'test_component':
                return this.testComponent(args.test_type);
            case 'get_conversation_transcript':
                return this.getConversationTranscript(args.max_chars);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
    readCurrentComponent() {
        return {
            prompt: this.component.prompt || '',
            structuredOutput: this.component.structuredOutput || '',
            uiCode: this.component.uiCode || '',
            title: this.component.component_title,
        };
    }
    async editPrompt(newPrompt, reasoning) {
        // Update in memory only (not database yet)
        this.component.prompt = newPrompt;
        return {
            success: true,
            message: 'Prompt updated in memory successfully. User can publish when ready.',
            reasoning
        };
    }
    async editStructuredOutput(newSchema, reasoning) {
        // Validate JSON
        try {
            JSON.parse(newSchema);
        }
        catch (e) {
            return {
                success: false,
                error: `Invalid JSON schema: ${e.message}`
            };
        }
        // Update in memory only (not database yet)
        this.component.structuredOutput = newSchema;
        return {
            success: true,
            message: 'Structured output updated in memory successfully. User can publish when ready.',
            reasoning
        };
    }
    async editUICode(newCode, reasoning) {
        // Update in memory only (not database yet)
        this.component.uiCode = newCode;
        return {
            success: true,
            message: 'UI code updated in memory successfully. User can publish when ready.',
            reasoning
        };
    }
    async testComponent(testType) {
        // This is a placeholder for now
        // In a full implementation, you'd:
        // 1. Fetch the conversation transcript
        // 2. Run the prompt + schema through an LLM
        // 3. Validate the output against the schema
        // 4. Try to render the UI with the data
        return {
            success: true,
            testType,
            message: `Test "${testType}" would run here. Full implementation requires LLM integration.`,
            note: 'This is a placeholder. Implement actual testing logic based on testType.',
        };
    }
    async getConversationTranscript(maxChars) {
        // Default to 5000 chars if not specified
        const limit = maxChars || 5000;
        try {
            // Fetch conversation record
            const response = await fetch(`${this.harperdbUrl}/Conversation/${this.conversationId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch conversation: ${response.statusText}`);
            }
            const conversation = await response.json();
            // Fetch readable transcript from S3
            const fullTranscript = await fetchFromS3(conversation.convo_readable_transcript_s3_link);
            const fullLength = fullTranscript.length;
            // Calculate helpful metadata
            const isTruncated = fullLength > limit;
            const returnedChars = isTruncated ? limit : fullLength;
            const percentageFetched = Math.round((returnedChars / fullLength) * 100);
            const durationMinutes = conversation.video_duration_seconds
                ? (conversation.video_duration_seconds / 60).toFixed(1)
                : 'unknown';
            // Truncate to requested length
            const transcript = isTruncated
                ? fullTranscript.slice(0, limit) + '\n\n[... transcript truncated. Call again with higher max_chars to see more ...]'
                : fullTranscript;
            return {
                success: true,
                conversationTitle: conversation.convo_title,
                transcript,
                metadata: {
                    totalCharacters: fullLength,
                    returnedCharacters: returnedChars,
                    percentageFetched: `${percentageFetched}%`,
                    truncated: isTruncated,
                    durationMinutes,
                    wordCount: conversation.word_count || 'unknown',
                    speakers: conversation.num_speakers || 'unknown',
                },
                // Legacy fields for backward compatibility
                totalCharacters: fullLength,
                returnedCharacters: returnedChars,
                truncated: isTruncated,
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to fetch transcript: ${error.message}`,
            };
        }
    }
    /**
     * Get the current component state (for returning updated state to frontend)
     */
    getCurrentComponent() {
        return this.component;
    }
}
