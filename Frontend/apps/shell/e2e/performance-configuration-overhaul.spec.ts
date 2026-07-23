// Rendered-state capture for the Performance configuration overhaul.
// Signs in through the shell as the tenant HR user and writes dark-mode screenshots of the new
// configuration IA (overview split, posture hub, unified evaluation setup, planning) into
// .local-docs/screenshots/performance-configuration-overhaul for review.
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { e2eEnv } from "./fixtures";

const SHOTS = path.resolve(__dirname, "../../../../.local-docs/screenshots/performance-configuration-overhaul");
const shot = (name: string) => path.join(SHOTS, name);

/** Tolerant sign-in: waits for hydration so the email fill isn't reset by a client re-render. */
async function ensureSignedIn(page: Page) {
  await page.goto("/performance", { waitUntil: "domcontentloaded" });
  const emailField = page.getByLabel("Email");
  if (await emailField.isVisible().catch(() => false)) {
    const signIn = page.getByRole("button", { name: "Sign In" });
    await expect(signIn).toBeEnabled();
    await emailField.fill(e2eEnv.email());
    await page.getByLabel("Password").fill(e2eEnv.password());
    await expect(emailField).toHaveValue(e2eEnv.email());
    await signIn.click();
    await expect(page).toHaveURL(/\/performance(?:\/|$)/, { timeout: 20_000 });
  }
}

test.describe("Performance configuration overhaul", () => {
  test("capture configuration surfaces", async ({ page }) => {
    test.setTimeout(120_000);

    await ensureSignedIn(page);

    // Go dark once; the shell persists the theme across navigation.
    await page.goto("/performance", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Performance", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: shot("01-overview-dark.png"), fullPage: true });

    // Posture hub.
    await page.goto("/performance/configuration", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Configuration", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Objectives per plan").waitFor({ timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: shot("02-configuration-hub-dark.png"), fullPage: true });

    // Unified evaluation setup — rating scales (read-first artifact / level spine).
    await page.goto("/performance/configuration/evaluation", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Evaluation setup", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: shot("03-evaluation-setup-scales-dark.png"), fullPage: true });

    // Templates segment (structural outline).
    await page.getByRole("tab", { name: "Templates" }).click();
    await expect(page.getByRole("tab", { name: "Templates" })).toHaveAttribute("aria-selected", "true");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("04-evaluation-setup-templates-dark.png"), fullPage: true });

    // Template preview (employee/manager experience).
    const preview = page.getByRole("button", { name: "Preview" });
    if (await preview.isVisible().catch(() => false)) {
      await preview.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: shot("05-template-preview-dark.png"), fullPage: true });
    }

    // Objective planning editor.
    await page.goto("/performance/configuration/planning", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Objective planning", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.getByText("Maximum objective count").waitFor({ timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: shot("06-objective-planning-dark.png"), fullPage: true });

    // Hub at mobile width.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/performance/configuration", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Configuration", level: 1 })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: shot("07-configuration-hub-mobile-dark.png"), fullPage: true });
  });
});
