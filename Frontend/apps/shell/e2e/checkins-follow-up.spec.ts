// spec: openspec/changes/performance-record-checkins-follow-up
// Captures the manager (Team progress) check-in workflow end-to-end and writes rendered-state
// screenshots into .local-docs/screenshots/checkins-follow-up for the change walkthrough.
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { e2eEnv } from "./fixtures";

/** Tolerant sign-in: reuse an existing shell session, otherwise sign in through the form. */
async function ensureSignedIn(page: Page, email: string, password: string) {
  await page.goto("/performance", { waitUntil: "domcontentloaded" });
  const emailField = page.getByLabel("Email");
  if (await emailField.isVisible().catch(() => false)) {
    // Wait for hydration so the first fill isn't reset by a client re-render.
    const signIn = page.getByRole("button", { name: "Sign In" });
    await expect(signIn).toBeEnabled();
    await emailField.fill(email);
    await page.getByLabel("Password").fill(password);
    await expect(emailField).toHaveValue(email);
    await signIn.click();
    await expect(page).toHaveURL(/\/performance(?:\/|$)/, { timeout: 20_000 });
  }
}

const CAMPAIGN_SLUG = "fy26-performance-planning";
const SHOTS = path.resolve(
  __dirname,
  "../../../../.local-docs/screenshots/checkins-follow-up",
);
const shot = (name: string) => path.join(SHOTS, name);

test.describe("Check-ins & follow-up — manager flow", () => {
  test("plan, complete with actions, and read the check-in record", async ({ page }) => {
    test.setTimeout(120_000);

    // 1. Sign in through the shell as the reviewer and open the participant's Team progress.
    await ensureSignedIn(page, e2eEnv.email(), e2eEnv.password());
    await page.goto(`/performance/team-progress/${CAMPAIGN_SLUG}`, { waitUntil: "domcontentloaded" });

    // The check-in panel lives under the participant's progress.
    const planButton = page.getByRole("button", { name: /^Plan$/ });
    await expect(planButton).toBeVisible({ timeout: 20_000 });
    await planButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot("01-manager-panel-empty-desktop-light.png"), fullPage: true });

    // 2. Plan a check-in.
    await planButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Date").fill("2026-09-15");
    await dialog.getByLabel("Focus").fill("Realign on the control-review setback");
    await dialog.getByLabel(/Agenda/i).fill("Review reopened items and agree on a recovery plan.");
    await page.screenshot({ path: shot("02-plan-dialog.png") });
    await dialog.getByRole("button", { name: "Plan check-in" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // 3. The planned check-in now shows in the panel.
    const plannedRow = page.getByRole("link", { name: /Realign on the control-review setback/ });
    await expect(plannedRow).toBeVisible({ timeout: 15_000 });
    await plannedRow.scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot("03-manager-panel-planned.png"), fullPage: true });

    // 4. Open the focused check-in detail.
    await plannedRow.click();
    await expect(page).toHaveURL(/\/team-progress\/.+\/check-ins\/.+/);
    await expect(page.getByText(/Realign on the control-review setback/).first()).toBeVisible();
    await page.screenshot({ path: shot("04-checkin-detail-planned.png"), fullPage: true });

    // 5. Complete the check-in with a shared summary.
    await page.getByRole("button", { name: "Mark complete" }).click();
    const completeDialog = page.getByRole("dialog");
    await expect(completeDialog).toBeVisible();
    await completeDialog
      .getByLabel("What was discussed")
      .fill(
        "We agreed the two reopened reviews slipped due to audit findings, not delivery. " +
          "Sami will re-plan the remaining reviews; I will secure an extra reviewer.",
      );
    await page.screenshot({ path: shot("05-complete-dialog.png") });
    await completeDialog.getByRole("button", { name: "Complete check-in" }).click();
    await expect(completeDialog).toBeHidden({ timeout: 15_000 });

    // 6. The completed record shows summary + immutable history (desktop light).
    await expect(page.getByText(/audit findings/)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot("06-checkin-detail-completed-desktop-light.png"), fullPage: true });

    // 7. Dark mode.
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.screenshot({ path: shot("07-checkin-detail-completed-dark.png"), fullPage: true });

    // 8. Mobile, dark.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(/audit findings/)).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeFalsy();
    await page.screenshot({ path: shot("08-checkin-detail-mobile-dark.png"), fullPage: true });
  });
});
