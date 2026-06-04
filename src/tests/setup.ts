import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest isn't running with `globals: true`, so Testing Library's automatic
// afterEach cleanup isn't registered. Register it once here so DOM renders
// don't accumulate across tests.
afterEach(() => {
  cleanup();
});
