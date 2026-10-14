export {
  getTenantByLocationId,
  getTenantById,
  registerTenant,
  listAllTenants,
  updateTenant,
  updateTenantBranding,
  suspendTenant,
  reactivateTenant,
} from "./service";

export {
  registerTenantSchema,
  updateTenantSchema,
  updateBrandingSchema,
  type RegisterTenantInput,
  type UpdateTenantInput,
  type UpdateBrandingInput,
} from "./schemas";

export { getLocationName } from "./repository";

export { withLocationName } from "@/lib/naming";
export { matchAgentToLocation, findDuplicateLocationNames } from "@/lib/location-matching";
