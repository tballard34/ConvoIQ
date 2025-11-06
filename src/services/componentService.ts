import { config } from '../config';
import type { Component } from '../types/schema';

/**
 * Fetch all components from HarperDB
 */
export async function fetchComponents(): Promise<Component[]> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Component/`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched components:', data);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching components:', error);
    return [];
  }
}

/**
 * Fetch a single component by ID
 */
export async function fetchComponentById(id: string): Promise<Component | null> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Component/${id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching component:', error);
    return null;
  }
}

/**
 * Create a draft component
 */
export async function createDraftComponent(): Promise<string> {
  const id = `comp-${Date.now()}`;
  
  const draftComponent: Component = {
    id,
    component_title: 'New Component',
    component_type: 'llm',
    prompt: '',
    code: '',
    structuredOutput: '',
    uiCode: '',
    status: 'draft',
    createdAt: new Date().toISOString()
  };
  
  const response = await fetch(`${config.harperdbUrl}/Component/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draftComponent)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create draft: ${response.statusText}`);
  }
  
  return id;
}

/**
 * Update a component
 */
export async function updateComponent(component: Component): Promise<void> {
  const response = await fetch(`${config.harperdbUrl}/Component/${component.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(component)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update component: ${response.statusText}`);
  }
}

/**
 * Generate a component title using AI with a 15-second timeout
 */
export async function generateComponentTitle(
  prompt: string,
  structuredOutput: string,
  uiCode: string
): Promise<{ thinking: string; title: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch(`${config.harperdbUrl}/GenerateComponentTitle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, structuredOutput, uiCode }),
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
      throw new Error('Title generation timed out after 15 seconds');
    }
    throw error;
  }
}
