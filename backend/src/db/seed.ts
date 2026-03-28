import 'dotenv/config';
import { db } from './client';

async function seed() {
  console.log('Seeding database...');

  // Add your seed data here
  void db;

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
