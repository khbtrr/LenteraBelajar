import { chromium } from 'playwright';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ storageState: '.qa/auth/student.json', viewport: { width: 320, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3005/id/student/dashboard');
  await page.getByRole('button', { name: 'Tema / Theme' }).click();
  await page.waitForTimeout(400);
  console.log(JSON.stringify(await page.locator('button').evaluateAll((buttons) => buttons.map((button) => ({ text: button.textContent, classes: button.className, color: getComputedStyle(button).color, background: getComputedStyle(button).backgroundColor })))));
} finally { await browser.close(); }
