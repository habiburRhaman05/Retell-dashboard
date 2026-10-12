import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// React Testing Library only auto-cleans when a global afterEach exists;
// we keep globals off, so wire it up explicitly (no-op outside jsdom).
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
