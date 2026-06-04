import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/shared/lib/AppProviders";

function Probe() {
  // Throws if there is no QueryClientProvider above it.
  useQueryClient();
  return <div>child rendered</div>;
}

describe("AppProviders", () => {
  it("renders children inside a QueryClientProvider", () => {
    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );
    expect(screen.getByText("child rendered")).toBeInTheDocument();
  });
});
