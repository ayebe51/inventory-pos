import { test, expect } from '@playwright/test';

test.describe('Purchase Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display Purchase Request page', async ({ page }) => {
    // Navigate to Purchase Requests
    await page.click('text=Procurement');
    await page.click('text=Purchase Requests');
    
    // Verify Page is rendered
    await expect(page.locator('text=Purchase Requests')).toBeVisible();
    await expect(page.locator('text=New Request')).toBeVisible();
  });

  test('should open create PR modal', async ({ page }) => {
    await page.click('text=Procurement');
    await page.click('text=Purchase Requests');
    
    await page.click('text=New Request');
    await expect(page.locator('.ant-modal-title').filter({ hasText: 'Create Purchase Request' })).toBeVisible();
  });
});
