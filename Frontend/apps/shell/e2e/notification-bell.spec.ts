// spec: e2e/specs/performance-operations-spine.plan.md
// seed: e2e/seed.spec.ts
import { loginForToken, loginThroughShell, test, expect } from "./fixtures";

const cycleId = "c8d1cc47-c1f5-412e-9ce0-96c27f5bed92";
const campaignSlug = "fy2026-objective-planning-2026";
const recipientEmployeeId = "aa9c37ae-a317-44f7-99a9-1ba05f42eb91";
const recipientEmail = process.env.FUSION_E2E_RECIPIENT_EMAIL ?? "iheb.labidi@atlasgroup.tn";
const recipientPassword = process.env.FUSION_E2E_RECIPIENT_PASSWORD ?? "Admin@123456";

test.describe("Notification bell", () => {
  test("should poll, activate, and deep-link a planning reminder", async ({ page }, testInfo) => {
    // 1. Sign in through the shell as the Atlas HR/manager account.
    const accessToken = await loginForToken(
      page.request,
      process.env.FUSION_E2E_EMAIL ?? "flit@gmail.com",
      process.env.FUSION_E2E_PASSWORD ?? "Admin@123456",
    );

    // 2. Record a planning reminder for an employee through the shell-origin Gateway route.
    const message = `E2E planning follow-up ${Date.now()}`;
    const reminder = await page.request.post(
      `/api/performance/planning-completion/campaigns/${cycleId}/reminders`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          targetEmployeeId: recipientEmployeeId,
          participantEmployeeId: recipientEmployeeId,
          targetType: "Participant",
          reason: message,
          triggerNotification: true,
        },
      },
    );
    expect(reminder.ok(), await reminder.text()).toBeTruthy();

    // 3. Sign in through the shell as the recipient employee.
    await page.evaluate(() => localStorage.removeItem("ey_hr_auth"));
    await page.context().clearCookies();
    await loginThroughShell(page, recipientEmail, recipientPassword);
    const unreadBell = page.getByRole("button", { name: /Notifications, \d+ unread/ });
    await expect(unreadBell).toBeVisible({ timeout: 15_000 });

    // 4. Open the notification list without marking the reminder read.
    const unreadLabel = await unreadBell.getAttribute("aria-label");
    await unreadBell.click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(unreadBell).toHaveAttribute("aria-label", unreadLabel!);
    await page.screenshot({ path: testInfo.outputPath("notification-desktop-light.png") });

    // 5. Activate the reminder and follow its contextual deep link.
    await page.getByRole("button", { name: new RegExp(message) }).click();
    await expect(page).toHaveURL(
      new RegExp(`/performance/campaigns/${campaignSlug}/completion/?$`),
    );
    await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();

    // 6. Render the list at mobile size in dark mode.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: /^Notifications$/ }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeFalsy();
    await page.screenshot({ path: testInfo.outputPath("notification-mobile-dark.png") });
  });
});
