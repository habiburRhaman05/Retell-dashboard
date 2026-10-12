import { z } from "zod";

export const registerTenantSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").optional(),
  crmLocationId: z.string().min(1, "CRM location ID is required"),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
