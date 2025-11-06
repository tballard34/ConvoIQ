import { seedConversations } from './seed-convos.js';
import { seedComponents } from './seed-components.js';
import { seedDashboards } from './seed-dashboards.js';

const HARPERDB_URL = process.env.HARPERDB_URL || 'http://localhost:9926';

async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seed...\n');
  console.log(`📡 Connecting to: ${HARPERDB_URL}\n`);

  try {
    await seedConversations();
    console.log();
    await seedComponents();
    console.log();
    await seedDashboards();
      
    console.log('\n🎉 Database fully seeded!');
    console.log('💡 You can run this script again anytime - it\'s idempotent!\n');

  } catch (error) {
    console.error('\n❌ Seed failed');
    process.exit(1);
  }
}

seedDatabase();
