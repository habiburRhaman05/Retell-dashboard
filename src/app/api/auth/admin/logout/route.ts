import { NextResponse } from "next/server";
import { clearAdminSession } from "@/modules/auth/middleware";

export async function POST() {
  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}
