import { test, expect } from '@playwright/test';

test.describe('Purchase Scenarios', () => {
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

  test('should display Purchase Request page', async ({ page }) => {
    await page.goto('/purchase/requests');
    
    // Verify Page is rendered
    await expect(page.locator('text=Purchase Requests')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=New Request')).toBeVisible();
  });

  test('should open create PR drawer', async ({ page }) => {
    await page.goto('/purchase/requests');
    
    await page.click('text=New Request');
    await expect(
      page.locator('.ant-drawer-title').filter({ hasText: 'Create Purchase Request' })
    ).toBeVisible({ timeout: 5000 });
  });
});
