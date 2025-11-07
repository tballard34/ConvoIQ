/**
 * Component Data Generator
 * Orchestrates LLM-based data generation from conversation transcripts
 * Extracts structured data according to component schemas
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

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

function buildUserPrompt(
	componentPrompt: string,
	transcript: string,
	structuredOutputSchema: string
): string {
	return `# Component Instructions
${componentPrompt}

# Conversation Transcript
${transcript}

# Required Output Schema
${structuredOutputSchema}

Please analyze the transcript according to the component instructions above and generate data that exactly matches the required output schema.`;
}

// ============================================================================
// Types
// ============================================================================

interface GenerateDataParams {
	componentId: string;
	conversationId: string;
	harperdbUrl: string;
	s3Client: S3Client;
	openRouterApiKey: string;
	s3BucketName: string;
}

interface GenerateDataResult {
	runId: string;
	status: 'succeeded' | 'failed';
	generatedData?: any;
	errorMessage?: string;
}

interface Component {
	id: string;
	component_type: string;
	prompt: string;
	structuredOutput: string;
}

interface Conversation {
	id: string;
	convo_readable_transcript_s3_link: string;
}

// ============================================================================
// Main Generation Logic
// ============================================================================

/**
 * Generate component data from conversation transcript
 * This is the main orchestration function that handles the entire pipeline
 */
export async function generateComponentData(
	params: GenerateDataParams
): Promise<GenerateDataResult> {
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
		const transcript = await fetchTranscriptFromS3(
			s3Client,
			s3BucketName,
			conversation.convo_readable_transcript_s3_link
		);
		console.log(`📊 Transcript length: ${transcript.length} characters`);

		// 5. Call LLM to generate structured data
		console.log('🤖 Calling OpenRouter to generate structured data...');
		const generatedData = await callLLM(
			openRouterApiKey,
			component.prompt,
			transcript,
			component.structuredOutput
		);
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

	} catch (error: any) {
		console.error(`❌ Data generation failed for ${runId}:`, error);

		// Update ComponentRun with failure status
		try {
			await updateComponentRun(harperdbUrl, runId, {
				status: 'failed',
				errorMessage: error.message,
				completedAt: new Date().toISOString(),
			});
			console.log('💾 ComponentRun status updated to: failed');
		} catch (updateError) {
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

async function createComponentRun(
	harperdbUrl: string,
	runId: string,
	componentId: string,
	conversationId: string
): Promise<void> {
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

async function fetchComponent(harperdbUrl: string, componentId: string): Promise<Component> {
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

function validateComponent(component: Component): void {
	if (component.component_type !== 'llm') {
		throw new Error('Component must be of type "llm" to generate data');
	}
}

async function fetchConversation(harperdbUrl: string, conversationId: string): Promise<Conversation> {
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

async function fetchTranscriptFromS3(
	s3Client: S3Client,
	bucketName: string,
	s3Link: string
): Promise<string> {
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

async function callLLM(
	apiKey: string,
	componentPrompt: string,
	transcript: string,
	structuredOutputSchema: string
): Promise<any> {
	// Build the prompt
	const userPrompt = buildUserPrompt(componentPrompt, transcript, structuredOutputSchema);

	// Parse structured output schema for response format
	let responseFormat: any = undefined;
	try {
		const schema = JSON.parse(structuredOutputSchema);
		// OpenRouter structured outputs API format
		responseFormat = {
			type: 'json_schema',
			json_schema: {
				name: 'component_data',
				strict: true,
				schema: schema
			}
		};
	} catch (schemaError) {
		console.warn('⚠️ Could not parse structured output schema, proceeding without response_format');
	}

	// Build request body
	const requestBody: any = {
		model: 'anthropic/claude-4.5-sonnet',
		messages: [
			{ role: 'system', content: SYSTEM_PROMPT },
			{ role: 'user', content: userPrompt }
		],
		temperature: 0.7,
		max_tokens: 8000,
	};

	// Add response_format if schema was successfully parsed
	if (responseFormat) {
		requestBody.response_format = responseFormat;
	}

	// Call OpenRouter API directly
	console.log('🤖 Calling OpenRouter API directly...');
	
	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://convoiq.dev',
			'X-Title': 'ConvoIQ',
		},
		body: JSON.stringify(requestBody)
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
	}

	const completion = await response.json();
	
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
	const contentString = typeof rawContent === 'string' 
		? rawContent 
		: JSON.stringify(rawContent);

	// Log the raw response for debugging
	console.log('📄 Raw LLM response (first 300 chars):', contentString.substring(0, 300));
	console.log('✅ LLM response received');

	// Parse and validate the response
	try {
		return JSON.parse(contentString);
	} catch (parseError: any) {
		console.error('❌ JSON parse failed');
		console.error('Full response:', contentString);
		throw new Error(`LLM returned invalid JSON: ${parseError.message}`);
	}
}

async function updateComponentRun(
	harperdbUrl: string,
	runId: string,
	updates: any
): Promise<void> {
	await fetch(`${harperdbUrl}/ComponentRun/${runId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates),
	});
}

