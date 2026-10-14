import { describe, expect, it } from "vitest";
import { buildQuery } from "./use-calls";

describe("buildQuery", () => {
  it("returns an empty string for no filters", () => {
    expect(buildQuery({})).toBe("");
  });

  it("omits undefined, null and empty-string values", () => {
    expect(buildQuery({ page: 1, status: undefined, disconnectionReason: "" })).toBe("?page=1");
  });

  it("includes every provided filter", () => {
    const qs = buildQuery({
      page: 2,
      pageSize: 25,
      status: "ended",
      direction: "inbound",
      sentiment: "Positive",
      disconnectionReason: "user_hangup",
      callSuccessful: true,
      start: 100,
      end: 200,
    });
    const params = new URLSearchParams(qs.slice(1));
    expect(params.get("page")).toBe("2");
    expect(params.get("pageSize")).toBe("25");
    expect(params.get("status")).toBe("ended");
    expect(params.get("direction")).toBe("inbound");
    expect(params.get("sentiment")).toBe("Positive");
    expect(params.get("disconnectionReason")).toBe("user_hangup");
    expect(params.get("callSuccessful")).toBe("true");
    expect(params.get("start")).toBe("100");
    expect(params.get("end")).toBe("200");
  });

  it("stringifies callSuccessful: false rather than dropping it", () => {
    expect(buildQuery({ callSuccessful: false })).toBe("?callSuccessful=false");
  });
});
