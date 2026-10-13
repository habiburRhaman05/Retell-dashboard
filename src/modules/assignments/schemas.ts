import { z } from "zod";

export const assignItemsSchema = z.object({
  /** CRM location ID of the tenant to assign to */
  locationId: z.string().min(1, "locationId is required"),
  /** Retell agent IDs to assign */
  retellIds: z.array(z.string().min(1)).min(1, "At least one item is required").max(100),
});

export const unassignItemsSchema = z.object({
  /** Retell agent IDs to remove from their current assignment */
  retellIds: z.array(z.string().min(1)).min(1, "At least one item is required").max(100),
});

export const privateItemsSchema = z.object({
  /** Retell IDs to mark private */
  retellIds: z.array(z.string().min(1)).min(1, "At least one item is required").max(100),
  reason: z.string().max(500).optional(),
});

export const unprivateItemsSchema = z.object({
  /** Retell IDs to make public (unmark private) */
  retellIds: z.array(z.string().min(1)).min(1, "At least one item is required").max(100),
});

export type AssignItemsInput = z.infer<typeof assignItemsSchema>;
export type UnassignItemsInput = z.infer<typeof unassignItemsSchema>;
export type PrivateItemsInput = z.infer<typeof privateItemsSchema>;
export type UnprivateItemsInput = z.infer<typeof unprivateItemsSchema>;
