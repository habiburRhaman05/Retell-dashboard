import { z } from "zod";

// Query params arrive as strings; z.coerce.boolean() would treat "false" as
// truthy (non-empty string), so this maps the two literal values explicitly.
const boolParam = z.enum(["true", "false"]).transform((v) => v === "true");

// locationId is never read from the request: both tenant/calls routes take
// it from the signed-in session (withTenant), never from query/body.
export const listCallsQuerySchema = z.object({
  start: z.coerce.number().int().optional(),
  end: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: z.enum(["registered", "not_connected", "ongoing", "ended", "error"]).optional(),
  direction: z.enum(["inbound", "outbound"]).optional(),
  sentiment: z.enum(["Negative", "Positive", "Neutral", "Unknown"]).optional(),
  disconnectionReason: z.string().min(1).optional(),
  callSuccessful: boolParam.optional(),
});
export type ListCallsQuery = z.infer<typeof listCallsQuerySchema>;
