import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const email = process.env.FUSION_E2E_EMAIL ?? "flit@gmail.com";
const password = process.env.FUSION_E2E_PASSWORD ?? "Admin@123456";

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
    await loginThroughShell(page, email, password);
    await use(page);
  },
});

export { expect } from "@playwright/test";
