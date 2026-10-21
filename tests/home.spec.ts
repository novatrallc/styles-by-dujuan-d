import { test, expect } from "@playwright/test";
test("branded homepage and services are visible while booking is disabled", async ({ page }) => {
 await page.goto("/");
 await expect(page.getByRole("heading", { name: /your look.*your signature/i })).toBeVisible();
 await expect(page.getByRole("link", { name: /book appointment/i })).toBeVisible();
 await page.getByRole("link", { name: /explore services/i }).first().click();
 await expect(page.getByRole("heading", { name: /every detail matters/i })).toBeVisible();
 await expect(page.getByText("Pricing coming soon")).toHaveCount(8);
 await page.goto("/book");
 await expect(page.getByText(/online checkout is not active yet/i)).toBeVisible();
});
