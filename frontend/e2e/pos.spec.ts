import { test, expect } from '@playwright/test';

const VALID_DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZTVkNjk0NS1lMjMyLTQ2NGQtOGYxMi0zYjE4NGUzYzk1MzEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZXMiOlsiT3duZXIiXSwiYnJhbmNoX2lkIjpudWxsLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiZTJlLXRva2VuLWp0aS12YWxpZCIsImlhdCI6MTc5MjY1NDU0NiwiZXhwIjoxNzkzMjU5MzQ2fQ.R--Iv_Sq2JdR_mBLgOU98torBMxBWDRi1rAJj6u5F7Y';

test.describe('POS Scenarios', () => {
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

  test('should display POS page', async ({ page }) => {
    await page.goto('/pos');
    
    // Verify POS Page or Active Shift gate is rendered
    await expect(
      page.locator('text=Product Catalog').or(page.locator('text=No Active Shift'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should verify cart interaction when shift is active', async ({ page }) => {
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    
    // Wait for either catalog or shift gate to appear
    await expect(page.locator('text=Product Catalog').or(page.locator('text=Open Shift'))).toBeVisible({ timeout: 10000 });
    
    // Check if shift is active
    const productCatalog = page.locator('text=Product Catalog');
    if (await productCatalog.isVisible()) {
      await expect(page.locator('text=Current Order')).toBeVisible();
      const productCard = page.locator('.ant-card-body').first();
      if (await productCard.isVisible()) {
        await productCard.click();
        await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
      }
    } else {
      // Shift gate is shown
      await expect(page.locator('text=Open Shift')).toBeVisible();
    }
  });
});
