import { Prisma } from "@prisma/client";
import prisma from "../models/Prisma.js";

/**
 * Detecta errores de transacción que son seguros de reintentar: conflictos de
 * serialización / deadlocks. En MySQL + isolationLevel Serializable dos operaciones
 * concurrentes sobre el mismo rango (mismo horario/fecha) hacen deadlock y el motor
 * aborta una: eso NO es un error de negocio, hay que reintentar.
 *
 * Prisma mapea el deadlock a P2034 ("write conflict or a deadlock"). Igual chequeamos
 * el mensaje crudo por si el driver lo expone como lock wait timeout (MySQL 1205/1213).
 */
export const isRetryableTransactionError = (error: unknown): boolean => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034") return true;
    }

    const message = String((error as any)?.message || "").toLowerCase();
    return (
        message.includes("deadlock") ||
        message.includes("write conflict") ||
        message.includes("lock wait timeout")
    );
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

type SerializableTransactionOptions = {
    maxRetries?: number;
    maxWait?: number;
    timeout?: number;
};

/**
 * Corre una transacción interactiva con isolationLevel Serializable y reintenta
 * automáticamente ante deadlocks / conflictos de serialización (con backoff + jitter).
 *
 * Los errores de negocio (sin cupo, sin cuota, etc.) NO son reintentables: se propagan
 * en el primer intento. Sólo se reintenta lo que detecta isRetryableTransactionError.
 */
export const runSerializableTransaction = async <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: SerializableTransactionOptions = {},
): Promise<T> => {
    const { maxRetries = 3, maxWait, timeout } = options;

    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            return await prisma.$transaction(fn, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
                ...(maxWait !== undefined ? { maxWait } : {}),
                ...(timeout !== undefined ? { timeout } : {}),
            });
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries && isRetryableTransactionError(error)) {
                // backoff exponencial acotado con jitter para dispersar reintentos concurrentes.
                const backoffMs = Math.min(50 * 2 ** attempt, 500) + Math.floor(Math.random() * 50);
                await sleep(backoffMs);
                continue;
            }
            throw error;
        }
    }

    throw lastError;
};
