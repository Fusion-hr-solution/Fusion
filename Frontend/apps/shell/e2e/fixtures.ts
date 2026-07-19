import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Provide shell E2E credentials via FUSION_E2E_* before running.`,
    );
  }
  return value;
}

/** Credentials are resolved lazily inside tests so missing env fails fast without breaking collection. */
export const e2eEnv = {
  email: () => requireEnv("FUSION_E2E_EMAIL"),
  password: () => requireEnv("FUSION_E2E_PASSWORD"),
  recipientEmail: () => requireEnv("FUSION_E2E_RECIPIENT_EMAIL"),
  recipientPassword: () => requireEnv("FUSION_E2E_RECIPIENT_PASSWORD"),
};

export async function loginThroughShell(
  page: Page,
  loginEmail: string,
  loginPassword: string,
) {
  await page.goto("/auth/signin?callbackUrl=/performance");
  await page.getByLabel("Email").fill(loginEmail);
  await page.getByLabel("Password").fill(loginPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/performance(?:\/|$)/);
}

export async function loginForToken(
  request: APIRequestContext,
  loginEmail: string,
  loginPassword: string,
) {
  const response = await request.post("/api/identity/auth/login", {
    data: { email: loginEmail, password: loginPassword },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = (await response.json()) as {
    data?: { accessToken?: string };
    accessToken?: string;
  };
  const accessToken = body.data?.accessToken ?? body.accessToken;
  expect(accessToken).toBeTruthy();
  return accessToken!;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await loginThroughShell(page, e2eEnv.email(), e2eEnv.password());
    await use(page);
  },
});

export { expect } from "@playwright/test";
