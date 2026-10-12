import { describe, expect, it } from "vitest";
import {
  getBlockReason,
  isBlocked,
  isLimitBlocked,
  type Entitlements,
} from "./use-entitlements";

function entitlements(entry: Partial<Entitlements[string]>): Entitlements {
  return {
    "agents.create": {
      enabled: true,
      used: 0,
      limit: null,
      status: "ok",
      ...entry,
    },
  };
}

describe("isBlocked", () => {
  it("is false while loading", () => {
    expect(isBlocked(null, "agents.create")).toBe(false);
  });

  it("is true only when the server reported blocked", () => {
    expect(isBlocked(entitlements({ status: "ok" }), "agents.create")).toBe(false);
    expect(isBlocked(entitlements({ status: "warning" }), "agents.create")).toBe(false);
    expect(isBlocked(entitlements({ status: "blocked" }), "agents.create")).toBe(true);
  });
});

describe("isLimitBlocked", () => {
  it("is true when the server said the limit was reached", () => {
    const e = entitlements({
      status: "blocked",
      reason: "LIMIT_REACHED",
      used: 3,
      limit: 2,
    });
    expect(isLimitBlocked(e, "agents.create")).toBe(true);
  });

  it("is false when blocked by an admin feature toggle", () => {
    // The screenshot case: 1 of 2 used, but the Features tab has the toggle off.
    const e = entitlements({
      enabled: false,
      status: "blocked",
      reason: "test",
      used: 1,
      limit: 2,
    });
    expect(isLimitBlocked(e, "agents.create")).toBe(false);
  });

  it("falls back to usage when the server sent no reason", () => {
    expect(
      isLimitBlocked(entitlements({ status: "blocked", used: 5, limit: 5 }), "agents.create")
    ).toBe(true);
    expect(
      isLimitBlocked(entitlements({ status: "blocked", used: 1, limit: 5 }), "agents.create")
    ).toBe(false);
  });
});

describe("getBlockReason", () => {
  it("is null while loading or when not blocked", () => {
    expect(getBlockReason(null, "agents.create")).toBeNull();
    expect(getBlockReason(entitlements({ status: "ok" }), "agents.create")).toBeNull();
  });

  it("reports usage when the limit caused the block", () => {
    const e = entitlements({
      status: "blocked",
      reason: "LIMIT_REACHED",
      used: 3,
      limit: 2,
    });
    expect(getBlockReason(e, "agents.create")).toBe(
      "You have used 3 of 2. Contact support to raise your limit."
    );
  });

  it("reports the real cause when an admin feature toggle caused the block", () => {
    const e = entitlements({
      enabled: false,
      status: "blocked",
      reason: "test",
      used: 1,
      limit: 2,
    });
    expect(getBlockReason(e, "agents.create")).toBe(
      "This feature is disabled (test). Contact support to enable it."
    );
  });

  it("still reports usage for a block with no reason but a limit", () => {
    const e = entitlements({ status: "blocked", used: 5, limit: 5 });
    expect(getBlockReason(e, "agents.create")).toBe(
      "You have used 5 of 5. Contact support to raise your limit."
    );
  });
});
