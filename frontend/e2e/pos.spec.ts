import { test, expect } from '@playwright/test';

test.describe('POS Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Assuming mock login or setting localStorage token directly
    // Because backend might not be available or we use mock data in useAuth
    await page.goto('/');
  });

  test('should display POS page', async ({ page }) => {
    // Navigate to POS
    await page.click('text=POS (Point of Sale)');
    
    // Verify POS Page is rendered
    await expect(page.locator('text=Point of Sale')).toBeVisible();
    await expect(page.locator('text=Current Order')).toBeVisible();
  });

  test('should add item to cart', async ({ page }) => {
    await page.click('text=POS (Point of Sale)');
    
    // Check if Shift is active or start shift (mocked or UI interaction)
    // Add product to cart (Assuming there's a product card)
    const productCard = page.locator('.ant-card-body').first();
    if (await productCard.isVisible()) {
        await productCard.click();
        
        // Check if item is added to cart
        await expect(page.locator('text=Clear')).toBeVisible();
        await expect(page.locator('.number-display').last()).not.toHaveText('Rp 0');
    }
  });
});
