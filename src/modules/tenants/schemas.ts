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

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color, e.g. #1d6bf3");

// Both fields are nullable (not just optional): sending `null` clears that
// color back to the app default, distinct from omitting the field entirely.
export const updateBrandingSchema = z.object({
  brandPrimaryColor: hexColor.nullable().optional(),
  brandSecondaryColor: hexColor.nullable().optional(),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
