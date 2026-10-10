import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:3005', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'authentication', testMatch: /auth\.setup\.ts/ },
    { name: 'mobile', dependencies: ['authentication'], testMatch: /release\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 800 } } },
    { name: 'tablet', dependencies: ['authentication'], testMatch: /release\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 900 } } },
    { name: 'desktop', dependencies: ['authentication'], testMatch: /release\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `${process.platform === 'win32' ? 'npm.cmd' : 'npm'} run start:qa`,
    url: 'http://127.0.0.1:3005/id/login', timeout: 120000, reuseExistingServer: false,
    env: { DATABASE_URL: 'postgresql://postgres:lentera-qa-only@127.0.0.1:55432/lentera_qa', AUTH_SECRET: 'lenterabelajar-qa-build-secret',
      AUTH_URL: 'http://127.0.0.1:3005', NEXTAUTH_URL: 'http://127.0.0.1:3005', AUTH_TRUST_HOST: 'true',
      UPLOAD_DIR: path.resolve('.qa/uploads'), CBT_WORKER_SECRET: 'qa-worker-secret', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
