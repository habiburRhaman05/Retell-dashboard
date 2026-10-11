/** Two agent names count as the same ignoring capitals and extra spaces. */
export function sameAgentName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string | null | undefined) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const x = norm(a);
  return x.length > 0 && x === norm(b);
}

export function duplicateAgentMessage(name: string): string {
  return `An agent named "${name}" already exists here. Choose a different name.`;
}

/** Client-side check against agents already loaded in the page. */
export function findDuplicateAgent<T extends { agent_id: string; agent_name: string | null }>(
  name: string,
  agents: T[] | undefined,
  excludeAgentId?: string
): T | undefined {
  return (agents ?? []).find((a) => a.agent_id !== excludeAgentId && sameAgentName(a.agent_name, name));
}
