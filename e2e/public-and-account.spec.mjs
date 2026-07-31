import { expect, test } from "@playwright/test";

test("the primary CTA opens the three-coin casting chamber", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Understand where you are/i })).toBeVisible();
  const cta = page.getByRole("link", { name: "Start Your Coin Reading" });
  await expect(cta).toHaveAttribute("href", "/cast/three_coin");
  await cta.click();
  await expect(page).toHaveURL(/\/cast\/three_coin$/);
  await expect(page.getByRole("heading", { name: "What would you like clarity on?" })).toBeVisible();
  await expect(page.getByText("For entertainment, cultural exploration, and self-reflection only"))
    .toBeVisible();
});

test("an unauthenticated account visit redirects to sign-in", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("development sign-in creates a session and exposes the account privacy confirmation", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("browser-e2e@example.com");
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Your Account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Delete account" })).toBeVisible();

  const deleteButton = page.getByRole("button", { name: "Permanently delete account" });
  await expect(deleteButton).toBeDisabled();
  await page.getByLabel("Confirm account email").fill("browser-e2e@example.com");
  await page.getByLabel("Type DELETE MY ACCOUNT").fill("DELETE MY ACCOUNT");
  await expect(deleteButton).toBeEnabled();
});
