import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const homes = { super_admin: '/platform/dashboard', admin: '/admin/dashboard', supervisor: '/supervisor/dashboard', teacher: '/teacher/dashboard', student: '/student/dashboard' };
for (const [role, home] of Object.entries(homes)) test.describe(role, () => {
  test.use({ storageState: `.qa/auth/${role}.json` });
  test('dashboard reflows, drawer restores focus, and dark mode remains readable', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`/id${home}`);
    await expect(page.locator('[data-lms-shell]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (info.project.name !== 'desktop') {
      const toggle = page.locator('#mobile-navigation-toggle');
      await toggle.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Menu navigasi' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Menu navigasi' })).toHaveCount(0);
      await expect(toggle).toBeFocused();
    }
    await mkdir('.qa/screenshots', { recursive: true });
    await page.screenshot({ path: `.qa/screenshots/${role}-${info.project.name}-light.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Tema / Theme' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.screenshot({ path: `.qa/screenshots/${role}-${info.project.name}-dark.png`, fullPage: true, animations: 'disabled' });
    if (role === 'student') {
      const ratio = await page.getByRole('button', { name: 'Lihat Semua Course', exact: true }).evaluate((button) => {
        const style = getComputedStyle(button);
        const luminance = (color: string) => {
          const values = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => Number(value) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
        };
        const a = luminance(style.color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('student privacy and legacy HTML', () => {
  test.use({ storageState: '.qa/auth/student.json' });
  test('renders legacy HTML safely and serves only authorized files', async ({ page, request }) => {
    await page.goto('/id/student/course/qa-e2e-course/modules');
    await expect(page.getByText('Materi QA untuk uji aksesibilitas.')).toBeVisible();
    expect(await page.evaluate(() => (window as typeof window & { QAXSS?: number }).QAXSS)).toBeUndefined();
    expect((await request.get('/api/files/qa-e2e-private.txt')).status()).toBe(200);
    const partial = await request.get('/api/files/qa-e2e-private.txt', { headers: { Range: 'bytes=0-3' } });
    expect(partial.status()).toBe(206);
    expect(await partial.text()).toBe('File');
    await page.goto('/id/student/course/qa-e2e-course/quiz/qa-e2e-practice');
    expect(await page.content()).not.toContain('_correctData');
    expect(await page.content()).not.toContain('passwordHash');
  });
});
