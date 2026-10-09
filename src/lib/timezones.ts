export interface TimezoneOption {
  value: string;
  label: string;
}

function offsetMinutes(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!m) return 0;
    const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return m[1] === "-" ? -mins : mins;
  } catch {
    return 0;
  }
}

function formatOffset(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `GMT${sign}${h}:${m}`;
}

/** IANA time zones sorted by UTC offset, labelled like "(GMT-05:00) America/New_York". */
export function getTimezoneOptions(): TimezoneOption[] {
  const now = new Date();
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
      "timeZone"
    );
  } catch {
    zones = [];
  }
  if (!zones.includes("UTC")) zones = [...zones, "UTC"];
  return zones
    .map((tz) => ({ tz, off: offsetMinutes(tz, now) }))
    .sort((a, b) => a.off - b.off || a.tz.localeCompare(b.tz))
    .map(({ tz, off }) => ({ value: tz, label: `(${formatOffset(off)}) ${tz.replace(/_/g, " ")}` }));
}
