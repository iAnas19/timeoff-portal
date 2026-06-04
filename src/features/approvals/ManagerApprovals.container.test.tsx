import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import ManagerApprovalsContainer from "@/features/approvals/ManagerApprovals";
import { hcmServer } from "@/mocks/server";
import { resetStore } from "@/mocks/store";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, Wrapper };
}

function renderContainer() {
  const { Wrapper } = makeWrapper();
  return render(<ManagerApprovalsContainer />, { wrapper: Wrapper });
}

describe("ManagerApprovalsContainer", () => {
  beforeAll(() => hcmServer.listen());
  beforeEach(() => resetStore());
  afterEach(() => hcmServer.resetHandlers());
  afterAll(() => hcmServer.close());

  it("shows the loading state while the queue is fetching", () => {
    renderContainer();
    expect(screen.getByText("Loading approval queue…")).toBeInTheDocument();
  });

  it("renders the seeded pending request once the queue resolves", async () => {
    renderContainer();
    expect(await screen.findByText("Alice Chen")).toBeInTheDocument();
    // The seeded request: New York · 2 days · 2026-07-01 → 2026-07-02
    expect(screen.getByText(/2026-07-01/)).toBeInTheDocument();
  });

  it("removes the card from the queue after a successful approval", async () => {
    renderContainer();
    expect(await screen.findByText("Alice Chen")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("No pending approvals.")).toBeInTheDocument();
  });

  it("removes the card from the queue after a denial", async () => {
    renderContainer();
    expect(await screen.findByText("Alice Chen")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /deny/i }));

    await waitFor(() =>
      expect(screen.queryByText("Alice Chen")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("No pending approvals.")).toBeInTheDocument();
  });

  it("surfaces an error alert when the pending-approvals route fails", async () => {
    hcmServer.use(
      http.get("*/api/hcm/approvals/pending", () =>
        HttpResponse.json(
          {
            code: "UNKNOWN",
            message: "boom",
            requestId: "x",
            retryable: false,
            timestamp: "2026-06-04T00:00:00.000Z",
          },
          { status: 500 },
        ),
      ),
    );

    renderContainer();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/boom/i);
  });

  it("shows the empty state when there are no pending approvals", async () => {
    hcmServer.use(
      http.get("*/api/hcm/approvals/pending", () =>
        HttpResponse.json({ approvals: [] }),
      ),
    );

    renderContainer();

    expect(
      await screen.findByText("No pending approvals."),
    ).toBeInTheDocument();
  });
});
