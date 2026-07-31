import { expect, test } from "@playwright/test";

test("the built server action boundary accepts an async invocation", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("built-boundary@example.com");
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();

  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByText("Use Google or a one-time email link to sign in.")).toBeVisible();
});

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

test("the complete three-coin ritual reveals an immutable result", async ({ page }) => {
  await page.goto("/cast/three_coin");
  await page.getByLabel("Your specific situation").fill(
    "I want to understand how to organize my work priorities over the next month.",
  );

  const beginButton = page.getByRole("button", { name: "Begin the ritual" });
  await expect(beginButton).toBeEnabled();
  await beginButton.click();

  for (let line = 1; line <= 6; line += 1) {
    const castButton = page.getByRole("button", { name: `Cast line ${line} of 6` });
    await expect(castButton).toBeEnabled();
    await castButton.click();
  }

  await expect(page.getByRole("heading", { name: "Reveal your result" })).toBeVisible();
  await page.getByLabel("Email").fill("casting-e2e@example.com");
  const revealButton = page.getByRole("button", { name: "Sign in & reveal" });
  await expect(revealButton).toBeEnabled();
  await revealButton.click();

  await expect(page.getByText("Ritual complete · Revealed")).toBeVisible();
  await expect(page.getByText("three-coin-v1 · king-wen-v1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /View in my history/ })).toBeVisible();
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
