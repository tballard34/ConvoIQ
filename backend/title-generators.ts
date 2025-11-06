/**
 * Generate a concise title for a component using AI
 */
export async function generateComponentTitle(
	apiKey: string,
	prompt: string,
	structuredOutput: string,
	uiCode: string
): Promise<{ thinking: string; title: string }> {
	console.log('✨ Generating component title...');

	// Build context for the LLM
	const componentContext = `Component Details:
- Prompt: ${prompt || '(empty)'}
- Structured Output Schema: ${structuredOutput || '(empty)'}
- UI Code: ${uiCode || '(empty)'}

Analyze these component details and generate a concise, descriptive title (3-6 words).`;

	console.log('🤖 Calling OpenRouter API directly...');
	
	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://convoiq.dev',
			'X-Title': 'ConvoIQ',
		},
		body: JSON.stringify({
			model: 'openai/gpt-oss-120b',
			messages: [
				{
					role: 'system',
					content: 'You are an AI that generates concise, descriptive titles for data components. Analyze the component details and provide your reasoning and a title.'
				},
				{
					role: 'user',
					content: componentContext
				}
			],
			provider: {
				sort: 'latency',
				// quantizations: ['fp16', 'bf16', 'fp32'],
				only: ['groq', 'fireworks'],
                allow_fallbacks: true,
			},
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'component_title_response',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							thinking: {
								type: 'string',
								description: 'Your reasoning for why this title captures what the component does'
							},
							title: {
								type: 'string',
								description: 'A concise, descriptive title (2-6 words) that describes what the component does'
							}
						},
						required: ['thinking', 'title'],
						additionalProperties: false
					}
				}
			},
			temperature: 0.5,
			max_tokens: 10000,
		})
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
		provider: completion.provider,
	});

	const content = completion.choices?.[0]?.message?.content;
	
	if (!content || typeof content !== 'string') {
		throw new Error('No content returned from LLM');
	}

	// Parse the structured JSON response
	const parsed = JSON.parse(content);
	
	if (!parsed.title || !parsed.thinking) {
		throw new Error('Invalid structured output: missing title or thinking');
	}

	console.log(`✅ Generated component title: "${parsed.title}"`);
	console.log(`💭 Thinking: "${parsed.thinking}"`);

	return { 
		thinking: parsed.thinking,
		title: parsed.title 
	};
}

/**
 * Generate a concise title for a conversation using AI
 */
export async function generateConversationTitle(
	apiKey: string,
	readableTranscript: string
): Promise<{ thinking: string; title: string }> {
	console.log('✨ Generating conversation title...');

	// Build context for the LLM
	const conversationContext = `Conversation Transcript:

${readableTranscript}

Analyze this conversation transcript and generate a concise, descriptive title (3-6 words) that captures the main topic or purpose of the conversation.`;

	console.log('🤖 Calling OpenRouter API directly...');
	
	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://convoiq.dev',
			'X-Title': 'ConvoIQ',
		},
		body: JSON.stringify({
			model: 'openai/gpt-oss-120b',
			messages: [
				{
					role: 'system',
					content: 'You are an AI that generates concise, descriptive titles for conversations. Analyze the conversation transcript and provide your reasoning and a title that captures the main topic or purpose'
				},
				{
					role: 'user',
					content: conversationContext
				}
			],
			provider: {
				sort: 'latency',
				// quantizations: ['fp16', 'bf16', 'fp32'],
				only: ['groq', 'fireworks'],
                allow_fallbacks: true,
			},
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'conversation_title_response',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							thinking: {
								type: 'string',
								description: 'Your reasoning for why this title captures what the conversation is about'
							},
							title: {
								type: 'string',
								description: 'A concise, descriptive title (3-6 words) that describes what the conversation is about'
							}
						},
						required: ['thinking', 'title'],
						additionalProperties: false
					}
				}
			},
			temperature: 0.5,
			max_tokens: 10000,
		})
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
		provider: completion.provider,
	});

	const content = completion.choices?.[0]?.message?.content;
	
	if (!content || typeof content !== 'string') {
		throw new Error('No content returned from LLM');
	}

	// Parse the structured JSON response
	const parsed = JSON.parse(content);
	
	if (!parsed.title || !parsed.thinking) {
		throw new Error('Invalid structured output: missing title or thinking');
	}

	console.log(`✅ Generated conversation title: "${parsed.title}"`);
	console.log(`💭 Thinking: "${parsed.thinking}"`);

	return { 
		thinking: parsed.thinking,
		title: parsed.title 
	};
}

/**
 * Generate a concise title for a dashboard using AI
 */
export async function generateDashboardTitle(
	apiKey: string,
	componentTitles: string[]
): Promise<{ thinking: string; title: string }> {
	console.log('✨ Generating dashboard title...');

	// Build context for the LLM
	const dashboardContext = `Dashboard Components:

${componentTitles.map((title, i) => `${i + 1}. ${title}`).join('\n')}

Analyze these component titles and generate a concise, descriptive title (3-6 words) for the dashboard that captures the overall purpose or theme.`;

	console.log('🤖 Calling OpenRouter API directly...');
	
	const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://convoiq.dev',
			'X-Title': 'ConvoIQ',
		},
		body: JSON.stringify({
			model: 'openai/gpt-oss-120b',
			messages: [
				{
					role: 'system',
					content: 'You are an AI that generates concise, descriptive titles for dashboards. Analyze the component titles and provide your reasoning and a title that captures the overall purpose'
				},
				{
					role: 'user',
					content: dashboardContext
				}
			],
			provider: {
				sort: 'latency',
				// quantizations: ['fp16', 'bf16', 'fp32'],
				only: ['groq', 'fireworks'],
                allow_fallbacks: true,
			},
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'dashboard_title_response',
					strict: true,
					schema: {
						type: 'object',
						properties: {
							thinking: {
								type: 'string',
								description: 'Your reasoning for why this title captures what the dashboard is about'
							},
							title: {
								type: 'string',
								description: 'A concise, descriptive title (3-6 words) that describes what the dashboard is about'
							}
						},
						required: ['thinking', 'title'],
						additionalProperties: false
					}
				}
			},
			temperature: 0.5,
			max_tokens: 10000,
		})
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
		provider: completion.provider,
	});

	const content = completion.choices?.[0]?.message?.content;
	
	if (!content || typeof content !== 'string') {
		throw new Error('No content returned from LLM');
	}

	// Parse the structured JSON response
	const parsed = JSON.parse(content);
	
	if (!parsed.title || !parsed.thinking) {
		throw new Error('Invalid structured output: missing title or thinking');
	}

	console.log(`✅ Generated dashboard title: "${parsed.title}"`);
	console.log(`💭 Thinking: "${parsed.thinking}"`);

	return { 
		thinking: parsed.thinking,
		title: parsed.title 
	};
}

