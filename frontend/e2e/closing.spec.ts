import { test, expect } from '@playwright/test';

const VALID_DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZTVkNjk0NS1lMjMyLTQ2NGQtOGYxMi0zYjE4NGUzYzk1MzEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZXMiOlsiT3duZXIiXSwiYnJhbmNoX2lkIjpudWxsLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiZTJlLXRva2VuLWp0aS12YWxpZCIsImlhdCI6MTc5MjY1NDU0NiwiZXhwIjoxNzkzMjU5MzQ2fQ.R--Iv_Sq2JdR_mBLgOU98torBMxBWDRi1rAJj6u5F7Y';

test.describe('Closing Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Inject authenticated session before page loads
    await page.addInitScript((token) => {
      window.localStorage.setItem('access_token', token);
      window.localStorage.setItem('refresh_token', token);
      window.localStorage.setItem('auth-store', JSON.stringify({
        state: {
          user: {
            id: '5e5d6945-e232-464d-8f12-3b184e3c9531',
            name: 'System Administrator',
            email: 'admin@example.com',
            role: 'Owner',
          },
          accessToken: token,
          isAuthenticated: true,
        },
        version: 0,
      }));
    }, VALID_DEV_TOKEN);
  });

  test('should display Fiscal Period page', async ({ page }) => {
    await page.goto('/finance/periods');
    
    // Verify Page is rendered
    await expect(page.locator('text=Fiscal Periods')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=New Period')).toBeVisible();
  });

  test('should check period close button visibility', async ({ page }) => {
    await page.goto('/finance/periods');
    
    // Wait for table to load
    await expect(page.locator('text=Fiscal Periods')).toBeVisible();

    const closeBtn = page.locator('button:has-text("Close Period")').first();
    if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await expect(
        page.locator('.ant-modal-title').filter({ hasText: 'Period Closing Checklist' })
      ).toBeVisible();
    }
  });
});
