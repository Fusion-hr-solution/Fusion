// spec: e2e/specs/performance-operations-spine.plan.md
// seed: e2e/seed.spec.ts
import { loginForToken, test, expect } from "./fixtures";

test.describe("Cycle attachments", () => {
  test("should upload and download an authorized cycle attachment", async ({ page }) => {
    // 1. Sign in through the shell as a tenant cycle manager and select an existing cycle.
    const accessToken = await loginForToken(
      page.request,
      process.env.FUSION_E2E_EMAIL ?? "flit@gmail.com",
      process.env.FUSION_E2E_PASSWORD ?? "Admin@123456",
    );
    const headers = { Authorization: `Bearer ${accessToken}` };
    const cyclesResponse = await page.request.get("/api/performance/cycles?page=1&pageSize=1", {
      headers,
    });
    expect(cyclesResponse.ok(), await cyclesResponse.text()).toBeTruthy();
    const cyclesBody = (await cyclesResponse.json()) as {
      data: { items: Array<{ id: string }> };
    };
    const ownerId = cyclesBody.data.items[0]?.id;
    expect(ownerId).toBeTruthy();

    // 2. Upload a small text attachment owned by that cycle.
    const marker = `Fusion attachment E2E ${Date.now()}`;
    const fileName = "performance-operations-proof.txt";
    const upload = await page.request.post("/api/performance/attachments", {
      headers,
      multipart: {
        ownerType: "PerformanceCycle",
        ownerId: ownerId!,
        file: {
          name: fileName,
          mimeType: "text/plain",
          buffer: Buffer.from(marker, "utf8"),
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBeTruthy();
    const uploadBody = (await upload.json()) as {
      data: { id: string; ownerType: string; ownerId: string; fileName: string; status: string };
    };
    expect(uploadBody.data).toMatchObject({
      ownerType: "PerformanceCycle",
      ownerId,
      fileName,
      status: "Committed",
    });

    // 3. Download the attachment with the same authorized account.
    const download = await page.request.get(
      `/api/performance/attachments/${uploadBody.data.id}`,
      { headers },
    );
    expect(download.ok(), await download.text()).toBeTruthy();
    expect(await download.text()).toBe(marker);
    expect(download.headers()["content-disposition"]).toContain(fileName);

    // 4. Attempt an upload with an unsupported owner type.
    const denied = await page.request.post("/api/performance/attachments", {
      headers,
      multipart: {
        ownerType: "EmployeeObjectivePlan",
        ownerId: ownerId!,
        file: {
          name: "denied.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("must not be stored", "utf8"),
        },
      },
    });
    expect(denied.status()).toBe(403);
  });
});
