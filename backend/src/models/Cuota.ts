import prisma from "./Prisma.js";
import type { Prisma } from "@prisma/client";

export { prisma as prismaClient };
export default prisma.cuota;
export type CuotaDelegate = typeof prisma.cuota;