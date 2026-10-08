import { test, expect } from '@playwright/test';

test.describe('Closing Scenarios', () => {
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
