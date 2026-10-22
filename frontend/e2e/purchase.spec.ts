import { test, expect } from '@playwright/test';

const VALID_DEV_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1ZTVkNjk0NS1lMjMyLTQ2NGQtOGYxMi0zYjE4NGUzYzk1MzEiLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZXMiOlsiT3duZXIiXSwiYnJhbmNoX2lkIjpudWxsLCJ0eXBlIjoiYWNjZXNzIiwianRpIjoiZTJlLXRva2VuLWp0aS12YWxpZCIsImlhdCI6MTc5MjY1NDU0NiwiZXhwIjoxNzkzMjU5MzQ2fQ.R--Iv_Sq2JdR_mBLgOU98torBMxBWDRi1rAJj6u5F7Y';

test.describe('Purchase Scenarios', () => {
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
