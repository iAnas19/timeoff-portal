import { test, expect, type APIRequestContext } from "@playwright/test";

const AUTH = { "x-mock-auth": "demo" };

async function resetStore(request: APIRequestContext) {
  await request.post("/api/hcm/simulate/reset", { headers: AUTH });
}

test("an anniversary bonus refreshes the balance mid-session with a banner", async ({
  page,
  request,
}) => {
  await resetStore(request);

  await page.goto("/employee");
  await expect(page.getByText(/days available/i).first()).toBeVisible();

  // HCM grants a work-anniversary day underneath the open app.
  await page.getByRole("button", { name: /anniversary bonus/i }).click();

  // The poll picks it up and the UI reconciles without surprising the user.
  await expect(page.getByText(/updated by hcm/i).first()).toBeVisible();
});
