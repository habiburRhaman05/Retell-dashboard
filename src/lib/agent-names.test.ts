import { describe, expect, it } from "vitest";
import { findDuplicateAgent, sameAgentName } from "./agent-names";

describe("sameAgentName", () => {
  it("ignores capitals and extra spaces", () => {
    expect(sameAgentName("  HVAC  Inbound ", "hvac inbound")).toBe(true);
  });

  it("never matches an empty or missing name", () => {
    expect(sameAgentName(null, null)).toBe(false);
    expect(sameAgentName("", "")).toBe(false);
    expect(sameAgentName("Reception", undefined)).toBe(false);
  });

  it("differences beyond case and spacing count as different names", () => {
    expect(sameAgentName("HVAC Inbound", "HVAC Outbound")).toBe(false);
  });
});

describe("findDuplicateAgent", () => {
  const agents = [
    { agent_id: "a1", agent_name: "HVAC Inbound" },
    { agent_id: "a2", agent_name: " plumbing  main " },
  ];

  it("finds an existing agent by name, ignoring case and spacing", () => {
    expect(findDuplicateAgent("PLUMBING Main", agents)?.agent_id).toBe("a2");
  });

  it("can exclude the agent being renamed", () => {
    expect(findDuplicateAgent("HVAC Inbound", agents, "a1")).toBeUndefined();
  });

  it("returns undefined when the list is missing or nothing matches", () => {
    expect(findDuplicateAgent("anything", undefined)).toBeUndefined();
    expect(findDuplicateAgent("Kitchen Sink", agents)).toBeUndefined();
  });
});
