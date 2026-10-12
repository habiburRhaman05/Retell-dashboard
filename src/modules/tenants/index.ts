export {
  getTenantByLocationId,
  getTenantById,
  registerTenant,
  listAllTenants,
  updateTenant,
  suspendTenant,
  reactivateTenant,
} from "./service";

export {
  registerTenantSchema,
  updateTenantSchema,
  type RegisterTenantInput,
  type UpdateTenantInput,
} from "./schemas";

export { getLocationName } from "./repository";

export { withLocationName } from "@/lib/naming";
export { matchAgentToLocation, findDuplicateLocationNames } from "@/lib/location-matching";
