import { defineConfig } from 'prisma/config';

if (!process.env.RELEASE_DATABASE_URL) throw new Error('RELEASE_DATABASE_URL must explicitly select the reviewed release database');
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: process.env.RELEASE_DATABASE_URL } });
