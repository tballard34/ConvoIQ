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
 * Create a new component
 */
export async function createComponent(component: Component): Promise<void> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Component/${component.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(component)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('Component created successfully:', component.id);
  } catch (error) {
    console.error('Error creating component:', error);
    throw error;
  }
}

/**
 * Fetch a single component by ID
 */
export async function fetchComponentById(id: string): Promise<Component | null> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Component/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
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
 * Delete a component by ID
 */
export async function deleteComponent(id: string): Promise<void> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Component/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('Component deleted successfully:', id);
  } catch (error) {
    console.error('Error deleting component:', error);
    throw error;
  }
}

