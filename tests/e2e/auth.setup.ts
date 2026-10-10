import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('authenticate all release roles through the real auth endpoint', async ({ playwright }) => {
  await mkdir('.qa/auth', { recursive: true });
  for (const role of ['super_admin', 'admin', 'supervisor', 'teacher', 'student']) {
    const request = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3005' });
    const csrf = await (await request.get('/api/auth/csrf')).json();
    const response = await request.post('/api/auth/callback/credentials', { form: {
      csrfToken: csrf.csrfToken, email: `${role}@e2e.test`, password: 'QaLentera2026!', callbackUrl: 'http://127.0.0.1:3005/id',
    }, headers: { 'X-Auth-Return-Redirect': '1' } });
    expect(response.ok()).toBe(true);
    const session = await (await request.get('/api/auth/session')).json();
    expect(session.user?.role).toBe(role.toUpperCase());
    await request.storageState({ path: `.qa/auth/${role}.json` });
    await request.dispose();
  }
});
