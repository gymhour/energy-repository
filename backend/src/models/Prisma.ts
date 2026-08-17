import { PrismaClient } from '@prisma/client';

/**
 * Tamaño del pool de Prisma. En Railway el backend es UN proceso largo, así que el
 * pool se comparte entre todos los requests: con connection_limit=1 las queries se
 * serializan y la API se vuelve un cuello de botella. (El 1 venía de Vercel, donde
 * cada lambda abría su propio pool contra un MySQL con tope de aperturas por hora.)
 * Se puede ajustar sin tocar código pasando ?connection_limit=N en DATABASE_URL.
 */
const DEFAULT_CONNECTION_LIMIT = '10';

function buildDatabaseUrl(): string | undefined {
    const raw = process.env.DATABASE_URL;
    if (!raw) return undefined;

    try {
        const url = new URL(raw);
        if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', DEFAULT_CONNECTION_LIMIT);
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
