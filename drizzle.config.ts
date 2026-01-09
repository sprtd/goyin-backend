import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Add debug logging
console.log('DATABASE_URL is set:', !!process.env.DATABASE_URL);

export default defineConfig({
  schema: './src/infrastructure/persistence/schemas/**.schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
  out: './src/infrastructure/persistence/migrations',
  migrations: {
    table: 'goyin_migrations',
    schema: 'public',
  },
});
