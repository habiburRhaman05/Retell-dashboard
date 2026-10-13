import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/middleware";
import * as retell from "@/lib/retell-api";
import { getKbLibrary } from "@/modules/assignments";

/** GET /api/admin/library/kbs — all knowledge bases with assignment status */
export const GET = withAdmin(async () => {
  const allKbs = await retell.listKnowledgeBases();
  const library = await getKbLibrary(allKbs);
  return NextResponse.json(library);
});
