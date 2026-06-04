import { test, expect, type APIRequestContext } from "@playwright/test";

const AUTH = { "x-mock-auth": "demo" };

async function resetStore(request: APIRequestContext) {
  await request.post("/api/hcm/simulate/reset", { headers: AUTH });
}

test("employee submits a request and the manager approves it", async ({
  page,
  request,
}) => {
  await resetStore(request);

  // Employee files a future, non-overlapping request.
  await page.goto("/employee");
  await page.getByLabel(/first day off/i).fill("2026-08-10");
  await page.getByLabel(/last day off/i).fill("2026-08-11");
  await page.getByRole("button", { name: /submit request/i }).click();

  // Submit is only "done" once it reconciles against HCM truth.
  await expect(
    page.getByText(/submitted and balance reconciled/i),
  ).toBeVisible();

  // Manager now sees the seed request + the new one; approving one removes it.
  await page.goto("/manager");
  const approveButtons = page.getByRole("button", { name: /^approve$/i });
  await expect(approveButtons).toHaveCount(2);
  await approveButtons.first().click();
  await expect(approveButtons).toHaveCount(1);
});
