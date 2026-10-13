import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { TEST_SESSION_SECRET } from "./auth";

// Session tokens are signed with this; no test may depend on a real secret.
process.env.SESSION_SECRET = TEST_SESSION_SECRET;

// React Testing Library only auto-cleans when a global afterEach exists;
// we keep globals off, so wire it up explicitly (no-op outside jsdom).
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
