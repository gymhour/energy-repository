import { PrismaClient } from '@prisma/client';

/**
 * En serverless (Vercel) cada instancia de lambda abre su propio pool de conexiones.
 * Prisma por defecto usa `num_cpus * 2 + 1` conexiones, y el hosting MySQL limita
 * las aperturas acumuladas por hora (max_connections_per_hour = 500).
 * Forzamos connection_limit=1 para que cada instancia consuma una sola conexión.
 */
function buildDatabaseUrl(): string | undefined {
    const raw = process.env.DATABASE_URL;
    if (!raw) return undefined;

    try {
        const url = new URL(raw);
        if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '1');
        if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
        if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15');
        return url.toString();
    } catch {
        return raw;
    }
}

function createPrismaClient() {
    const datasourceUrl = buildDatabaseUrl();
    return new PrismaClient({
        ...(datasourceUrl ? { datasourceUrl } : {}),
        //log: ['query', 'info', 'warn', 'error'], // Registra todas las consultas y errores
    });
}

// Reutilizamos la misma instancia entre invocaciones "calientes" de la lambda
// y entre recargas en desarrollo, en lugar de abrir un pool nuevo cada vez.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;

export default prisma;
