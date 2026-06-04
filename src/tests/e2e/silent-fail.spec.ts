import { test, expect, type APIRequestContext } from "@playwright/test";

const AUTH = { "x-mock-auth": "demo" };

async function resetStore(request: APIRequestContext) {
  await request.post("/api/hcm/simulate/reset", { headers: AUTH });
}

test("a silent HCM failure is detected and the user is warned to verify", async ({
  page,
  request,
}) => {
  await resetStore(request);

  await page.goto("/employee");

  // Arm the next write to return 200 but not persist.
  await page.getByRole("button", { name: /arm silent fail/i }).click();

  await page.getByLabel(/first day off/i).fill("2026-08-20");
  await page.getByLabel(/last day off/i).fill("2026-08-20");
  await page.getByRole("button", { name: /submit request/i }).click();

  // HTTP said OK; reconciliation caught that nothing changed.
  await expect(
    page.getByText(/verify before resubmitting/i).first(),
  ).toBeVisible();
});
