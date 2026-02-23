import { test, expect } from '@playwright/test';

test('app loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.goto('http://localhost:18799/', { waitUntil: 'networkidle' });
  
  // Check page loaded
  await expect(page).toHaveTitle(/BrainClaw|OpenClaw/);
  
  // Check main app element exists
  await expect(page.locator('openclaw-app')).toBeVisible({ timeout: 10000 });
  
  // Check for loading spinner - should disappear
  const spinner = page.locator('.loading, [class*="loading"], .spinner');
  if (await spinner.count() > 0) {
    await expect(spinner).toBeHidden({ timeout: 30000 });
  }
  
  // No JS errors
  expect(errors).toEqual([]);
});

test('chat interface appears', async ({ page }) => {
  await page.goto('http://localhost:18799/', { waitUntil: 'networkidle' });
  
  // Wait for app to initialize
  await page.waitForTimeout(2000);
  
  // Take screenshot for visual verification
  await page.screenshot({ path: 'e2e/screenshots/app-loaded.png', fullPage: true });
  
  // Check if we see either chat input or connection status
  const chatInput = page.locator('textarea, input[type="text"], [contenteditable]');
  const connectionStatus = page.locator('[class*="status"], [class*="connect"]');
  
  const hasUI = await chatInput.count() > 0 || await connectionStatus.count() > 0;
  expect(hasUI).toBeTruthy();
});
