import { test, expect } from '@playwright/test';

test.describe('POS Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Inject authenticated session before page loads
    await page.addInitScript(() => {
      window.localStorage.setItem('access_token', 'test-e2e-token');
      window.localStorage.setItem('auth-store', JSON.stringify({
        state: {
          user: {
            id: 'test-admin-id',
            name: 'System Administrator',
            email: 'admin@example.com',
            role: 'Owner',
          },
          accessToken: 'test-e2e-token',
          isAuthenticated: true,
        },
        version: 0,
      }));
    });
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
    
    // Check if shift is active
    const productCatalog = page.locator('text=Product Catalog');
    if (await productCatalog.isVisible()) {
      await expect(page.locator('text=Current Order')).toBeVisible();
      const productCard = page.locator('.ant-card-body').first();
      if (await productCard.isVisible()) {
        await productCard.click();
        await expect(page.locator('text=Clear')).toBeVisible();
      }
    } else {
      // Shift gate is shown
      await expect(page.locator('text=Open Shift')).toBeVisible();
    }
  });
});
