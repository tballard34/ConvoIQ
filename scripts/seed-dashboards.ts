import fetch from 'node-fetch';
import type { Dashboard } from '../src/types/schema.js';

const HARPERDB_URL = process.env.HARPERDB_URL || 'http://localhost:9926';
const HARPERDB_USERNAME = process.env.HARPERDB_USERNAME || '';
const HARPERDB_PASSWORD = process.env.HARPERDB_PASSWORD || '';

// Example dashboards with component layouts
const dashboards: Dashboard[] = [
  {
    id: 'dash-001',
    dashboard_title: 'Sales Call Analysis',
    layout: [
      { componentId: 'comp-llm-001', x: 0, y: 0, width: 6, height: 4 },
      { componentId: 'comp-code-001', x: 6, y: 0, width: 6, height: 4 }
    ],
    status: 'published',
    createdAt: new Date().toISOString()
  },
  {
    id: 'dash-002',
    dashboard_title: 'Quick Overview',
    layout: [
      { componentId: 'comp-llm-001', x: 0, y: 0, width: 12, height: 3 }
    ],
    status: 'draft',
    createdAt: new Date().toISOString()
  }
];

async function upsertDashboard(dashboard: Dashboard): Promise<{ success: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (HARPERDB_USERNAME && HARPERDB_PASSWORD) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${HARPERDB_USERNAME}:${HARPERDB_PASSWORD}`).toString('base64');
  }
  
  // Convert layout array to JSON string for storage
  const response = await fetch(`${HARPERDB_URL}/Dashboard/${dashboard.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      ...dashboard,
      layout: JSON.stringify(dashboard.layout)
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HarperDB error: ${error}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : { success: true };
}

export async function seedDashboards(): Promise<void> {
  console.log('📊 Seeding dashboards...\n');

  try {
    for (const dashboard of dashboards) {
      console.log(`📝 Seeding dashboard: "${dashboard.dashboard_title}"`);
      
      await upsertDashboard(dashboard);
      
      console.log(`  ✅ Dashboard "${dashboard.dashboard_title}" seeded successfully`);
    }

    console.log(`\n✨ Seeded ${dashboards.length} dashboard(s)!`);

  } catch (error) {
    console.error('❌ Error seeding dashboards:', (error as Error).message);
    console.error('Full error:', error);
    throw error;
  }
}

// Allow running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDashboards()
    .then(() => {
      console.log('💡 You can run this script again anytime - it\'s idempotent!\n');
    })
    .catch(() => {
      process.exit(1);
    });
}

