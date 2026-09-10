import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dummy?schema=public',
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
