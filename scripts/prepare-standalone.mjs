import { cp, mkdir } from "node:fs/promises";

const standaloneDir = ".next/standalone";
await mkdir(`${standaloneDir}/.next`, { recursive: true });

try {
  await cp("public", `${standaloneDir}/public`, { recursive: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

await cp(".next/static", `${standaloneDir}/.next/static`, { recursive: true });
console.log("Prepared standalone server with public and static assets.");
