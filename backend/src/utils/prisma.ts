// DEPRECATED: prefer importing from "../db/prisma" directly.
// This shim exists so the existing service/controller imports keep working
// while the codebase migrates to the canonical db/ path. Re-exports the same
// singleton — there is only ever one PrismaClient in the process.

import { getPrisma } from "../db/prisma";

export const prisma = getPrisma();
export { getPrisma, disconnectPrisma } from "../db/prisma";
