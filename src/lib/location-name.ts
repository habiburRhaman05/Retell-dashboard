import { prisma } from "@/lib/prisma";

/** The saved display name of a location (sub-account), or null when none is known. */
export async function getLocationName(locationId: string): Promise<string | null> {
  try {
    const loc = await prisma.location.findUnique({
      where: { locationId },
      select: { name: true },
    });
    return loc?.name?.trim() || null;
  } catch {
    // A name is a nicety; never block creating something because it could not be read.
    return null;
  }
}
