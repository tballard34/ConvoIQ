/**
 * Component Data Generator
 * Orchestrates LLM-based data generation from conversation transcripts
 * Extracts structured data according to component schemas
 */
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { OpenRouter } from '@openrouter/sdk';
// ============================================================================
// Prompts
// ============================================================================
const SYSTEM_PROMPT = `You are a data extraction and analysis assistant. Your job is to analyze conversation transcripts and generate structured data according to a given schema.

# Your Task
1. Read the conversation transcript carefully
2. Read the user's prompt describing what data to extract
3. Generate data that EXACTLY matches the provided JSON schema
4. Be accurate, concise, and follow the schema strictly

# Rules
- Your output must be valid JSON matching the schema
- If the transcript doesn't contain relevant information, use null or empty arrays as appropriate
- Do not add fields not in the schema
- Do not omit required fields
- Be objective and factual
- Pay attention to data types (strings, numbers, arrays, objects)
- Respect min/max constraints if specified in the schema

# Output Format
Respond ONLY with the JSON data. Do not include any explanation, markdown formatting, or additional text.`;
function buildUserPrompt(componentPrompt, transcript, structuredOutputSchema) {
    return `# Component Instructions
${componentPrompt}

# Conversation Transcript
${transcript}

# Required Output Schema
${structuredOutputSchema}

Please analyze the transcript according to the component instructions above and generate data that exactly matches the required output schema.`;
}
// ============================================================================
// Main Generation Logic
// ============================================================================
/**
 * Generate component data from conversation transcript
 * This is the main orchestration function that handles the entire pipeline
 */
export async function generateComponentData(params) {
    const { componentId, conversationId, harperdbUrl, s3Client, openRouterApiKey, s3BucketName } = params;
    const runId = `${componentId}_${conversationId}`;
    try {
        // 1. Create ComponentRun record with status 'generating'
        console.log(`📝 Creating ComponentRun: ${runId}`);
        await createComponentRun(harperdbUrl, runId, componentId, conversationId);
        // 2. Fetch component from database
        console.log(`📥 Fetching component: ${componentId}`);
        const component = await fetchComponent(harperdbUrl, componentId);
        validateComponent(component);
        // 3. Fetch conversation from database
        console.log(`📥 Fetching conversation: ${conversationId}`);
        const conversation = await fetchConversation(harperdbUrl, conversationId);
        // 4. Get readable transcript from S3
        console.log('📄 Fetching readable transcript from S3...');
        const transcript = await fetchTranscriptFromS3(s3Client, s3BucketName, conversation.convo_readable_transcript_s3_link);
        console.log(`📊 Transcript length: ${transcript.length} characters`);
        // 5. Call LLM to generate structured data
        console.log('🤖 Calling OpenRouter to generate structured data...');
        const generatedData = await callLLM(openRouterApiKey, component.prompt, transcript, component.structuredOutput);
        console.log('✅ Valid JSON generated');
        // 6. Update ComponentRun with success
        console.log('💾 Updating ComponentRun with success status...');
        await updateComponentRun(harperdbUrl, runId, {
            generatedData: JSON.stringify(generatedData),
            status: 'succeeded',
            completedAt: new Date().toISOString(),
        });
        console.log('✅ Component data generation complete');
        return {
            runId,
            status: 'succeeded',
            generatedData,
        };
    }
    catch (error) {
        console.error(`❌ Data generation failed for ${runId}:`, error);
        // Update ComponentRun with failure status
        try {
            await updateComponentRun(harperdbUrl, runId, {
                status: 'failed',
                errorMessage: error.message,
                completedAt: new Date().toISOString(),
            });
            console.log('💾 ComponentRun status updated to: failed');
        }
        catch (updateError) {
            console.error('Failed to update ComponentRun status:', updateError);
        }
        return {
            runId,
            status: 'failed',
            errorMessage: error.message,
        };
    }
}
// ============================================================================
// Helper Functions
// ============================================================================
async function createComponentRun(harperdbUrl, runId, componentId, conversationId) {
    await fetch(`${harperdbUrl}/ComponentRun/${runId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: runId,
            componentId,
            conversationId,
            status: 'generating',
            createdAt: new Date().toISOString(),
        }),
    });
}
async function fetchComponent(harperdbUrl, componentId) {
    const url = `${harperdbUrl}/Component/${componentId}`;
    console.log(`📥 Fetching component from: ${url}`);
    const response = await fetch(url);
    console.log(`📊 Component fetch response:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`❌ Component fetch failed:`, errorBody);
        throw new Error(`Failed to fetch component: ${response.statusText}`);
    }
    const component = await response.json();
    console.log(`✅ Component fetched:`, component);
    return component;
}
function validateComponent(component) {
    if (component.component_type !== 'llm') {
        throw new Error('Component must be of type "llm" to generate data');
    }
}
async function fetchConversation(harperdbUrl, conversationId) {
    const response = await fetch(`${harperdbUrl}/Conversation/${conversationId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch conversation: ${response.statusText}`);
    }
    const conversation = await response.json();
    if (!conversation.convo_readable_transcript_s3_link) {
        throw new Error('No readable transcript found for this conversation');
    }
    return conversation;
}
async function fetchTranscriptFromS3(s3Client, bucketName, s3Link) {
    const s3Key = s3Link.replace(`s3://${bucketName}/`, '');
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
    });
    const response = await s3Client.send(command);
    const transcript = await response.Body?.transformToString();
    if (!transcript) {
        throw new Error('Failed to read transcript from S3');
    }
    return transcript;
}
async function callLLM(apiKey, componentPrompt, transcript, structuredOutputSchema) {
    // Build the prompt
    const userPrompt = buildUserPrompt(componentPrompt, transcript, structuredOutputSchema);
    // Initialize OpenRouter SDK client
    const client = new OpenRouter({
        apiKey: apiKey,
    });
    // Parse structured output schema for response format
    let responseFormat = undefined;
    try {
        const schema = JSON.parse(structuredOutputSchema);
        // OpenRouter structured outputs API format
        responseFormat = {
            type: 'json_schema',
            jsonSchema: {
                name: 'component_data',
                strict: true,
                schema: schema
            }
        };
    }
    catch (schemaError) {
        console.warn('⚠️ Could not parse structured output schema, proceeding without response_format');
    }
    console.log('🤖 Calling OpenRouter via SDK...');
    // @ts-ignore - SDK types may not include all options
    const completion = await client.chat.send({
        model: 'anthropic/claude-4.5-sonnet',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        maxTokens: 8000,
        responseFormat: responseFormat,
        stream: false,
        headers: {
            'HTTP-Referer': 'https://convoiq.dev',
            'X-Title': 'ConvoIQ',
        }
    });
    // Log provider information
    console.log('📊 Provider Info:', {
        model: completion.model,
        id: completion.id,
    });
    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
        throw new Error('No content returned from LLM');
    }
    // Handle content that might be string or array
    let contentString = typeof rawContent === 'string'
        ? rawContent
        : JSON.stringify(rawContent);
    // Log the raw response for debugging
    console.log('📄 Raw LLM response (first 300 chars):', contentString.substring(0, 300));
    // FALLBACK: Strip markdown code fences if present (Claude sometimes ignores response_format)
    if (contentString.trim().startsWith('```')) {
        console.log('⚠️ Detected markdown code fences, stripping them...');
        contentString = contentString
            .replace(/^```json\s*/i, '') // Remove opening ```json
            .replace(/^```\s*/i, '') // Remove opening ``` without json
            .replace(/\s*```$/, '') // Remove closing ```
            .trim();
        console.log('✅ Markdown stripped');
    }
    console.log('✅ LLM response received');
    // Parse and validate the response
    try {
        return JSON.parse(contentString);
    }
    catch (parseError) {
        console.error('❌ JSON parse failed');
        console.error('Full response:', contentString);
        throw new Error(`LLM returned invalid JSON: ${parseError.message}`);
    }
}
async function updateComponentRun(harperdbUrl, runId, updates) {
    await fetch(`${harperdbUrl}/ComponentRun/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
}
