import { config } from '../config';
import type { Dashboard } from '../types/schema';

/**
 * Fetch all dashboards from HarperDB
 */
export async function fetchDashboards(): Promise<Dashboard[]> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Dashboard/`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Fetched dashboards:', data);
    
    // Parse layout JSON strings into arrays
    const dashboards = Array.isArray(data) ? data : [];
    return dashboards.map(dashboard => ({
      ...dashboard,
      layout: typeof dashboard.layout === 'string' 
        ? JSON.parse(dashboard.layout) 
        : dashboard.layout
    }));
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    return [];
  }
}

/**
 * Fetch a single dashboard by ID
 */
export async function fetchDashboardById(id: string): Promise<Dashboard | null> {
  try {
    const response = await fetch(`${config.harperdbUrl}/Dashboard/${id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse layout JSON string into array
    return {
      ...data,
      layout: typeof data.layout === 'string' 
        ? JSON.parse(data.layout) 
        : data.layout
    };
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }
}

/**
 * Create a draft dashboard
 */
export async function createDraftDashboard(): Promise<string> {
  const id = `dash-${Date.now()}`;
  
  const draftDashboard: Dashboard = {
    id,
    dashboard_title: 'New Dashboard',
    layout: [],
    status: 'draft',
    createdAt: new Date().toISOString()
  };
  
  const response = await fetch(`${config.harperdbUrl}/Dashboard/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draftDashboard,
      layout: JSON.stringify(draftDashboard.layout)
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create draft: ${response.statusText}`);
  }
  
  return id;
}

/**
 * Update a dashboard
 */
export async function updateDashboard(dashboard: Dashboard): Promise<void> {
  const response = await fetch(`${config.harperdbUrl}/Dashboard/${dashboard.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...dashboard,
      layout: JSON.stringify(dashboard.layout)
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update dashboard: ${response.statusText}`);
  }
}

