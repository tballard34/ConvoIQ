/**
 * Service for managing component runs and data generation
 */

import { config } from '../config';

export interface ComponentRun {
  id: string;
  componentId: string;
  conversationId: string;
  generatedData: string;
  status: 'generating' | 'succeeded' | 'failed';
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GenerateComponentDataResponse {
  runId: string;
  status: string;
  generatedData?: any;
  errorMessage?: string;
}

/**
 * Generate component data by calling the backend LLM endpoint
 * This creates a ComponentRun and processes the conversation transcript
 */
export async function generateComponentData(
  componentId: string,
  conversationId: string
): Promise<GenerateComponentDataResponse> {
  const response = await fetch(`${config.harperdbUrl}/GenerateComponentData`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      componentId,
      conversationId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate component data: ${error}`);
  }

  return response.json();
}

/**
 * Get a component run by composite ID
 */
export async function getComponentRun(
  componentId: string,
  conversationId: string
): Promise<ComponentRun | null> {
  const runId = `${componentId}_${conversationId}`;
  
  try {
    const response = await fetch(`${config.harperdbUrl}/ComponentRun/${runId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch component run: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching component run:', error);
    return null;
  }
}

/**
 * Check if a component run exists and has succeeded
 */
export async function hasSuccessfulRun(
  componentId: string,
  conversationId: string
): Promise<boolean> {
  const run = await getComponentRun(componentId, conversationId);
  return run !== null && run.status === 'succeeded';
}

/**
 * Get the generated data for a component run
 * Returns parsed JSON data or null if not available
 */
export async function getGeneratedData(
  componentId: string,
  conversationId: string
): Promise<any | null> {
  const run = await getComponentRun(componentId, conversationId);
  
  if (!run || run.status !== 'succeeded' || !run.generatedData) {
    return null;
  }

  try {
    return JSON.parse(run.generatedData);
  } catch (error) {
    console.error('Error parsing generated data:', error);
    return null;
  }
}

