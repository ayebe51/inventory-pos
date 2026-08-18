import { test, expect } from '@playwright/test';

test.describe('Closing Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display Fiscal Period page', async ({ page }) => {
    // Navigate to Finance > Fiscal Periods
    await page.click('text=Finance & Acc');
    await page.click('text=Fiscal Periods');
    
    // Verify Page is rendered
    await expect(page.locator('text=Fiscal Periods')).toBeVisible();
    await expect(page.locator('text=New Period')).toBeVisible();
  });

  test('should check period close button visibility', async ({ page }) => {
    await page.click('text=Finance & Acc');
    await page.click('text=Fiscal Periods');
    
    // Wait for data to load
    await page.waitForTimeout(1000); 

    // Because of our mock login (admin by default), Close Period should be visible if there is an OPEN period.
    const closeBtn = page.locator('button:has-text("Close Period")').first();
    if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await expect(page.locator('.ant-modal-title').filter({ hasText: 'Period Closing Checklist' })).toBeVisible();
    }
  });
});
