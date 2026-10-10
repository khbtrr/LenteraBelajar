import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa' },
});
