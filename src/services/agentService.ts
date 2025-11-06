import { config } from '../config';

export type MessageType = 'thinking' | 'assistant' | 'tool_call' | 'tool_result' | 'success' | 'error';

export interface AgentMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  metadata?: {
    toolName?: string;
    reasoning?: string;
    args?: any;
    result?: any;
    [key: string]: any;
  };
}

export interface AgentRequest {
  componentId: string;
  componentTitle: string;
  conversationId: string;
  conversationTitle: string;
  userPrompt: string;
  currentState: {
    prompt: string;
    structuredOutput: string;
    uiCode: string;
  };
  editModes: {
    editPrompt: boolean;
    editData: boolean;
    editUICode: boolean;
  };
}

export interface AgentResponse {
  success: boolean;
  message: string;
  error?: string;
  messages?: AgentMessage[];
  updatedState?: {
    prompt: string;
    structuredOutput: string;
    uiCode: string;
  };
}

/**
 * Run the agent to edit a component (with streaming support)
 * 
 * This calls the backend agent which will stream:
 * 1. Assistant message chunks (real-time typing effect)
 * 2. Tool calls as they happen
 * 3. Tool results after execution
 * 4. Final updated component state
 */
export async function runAgent(
  request: AgentRequest,
  onEvent: (event: string, data: any) => void
): Promise<void> {
  const response = await fetch(`${config.harperdbUrl}/RunAgent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Agent request failed: ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        if (currentEvent) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(currentEvent, data);
          } catch (error) {
            console.error('Failed to parse SSE data:', line);
          }
          currentEvent = '';
        }
      }
    }
  }
}


