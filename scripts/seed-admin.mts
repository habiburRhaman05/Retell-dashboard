import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables");
    process.exit(1);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists (role: ${existing.role})`);
    return;
  }

  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  const companyId = crypto.randomBytes(24).toString("base64url");
  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, role: "owner", name: "Admin", companyId },
  });

  console.log(`Created admin user: ${admin.email} (role: owner)`);
  console.log(`Auto-login link (treat like a password, do not share): /admin?companyId=${companyId}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
