// api/cron/checkVencidas.ts — CRON 1 de Vercel (Hobby permite 2 crons).
// Validación de cuotas: marca como vencidas las cuotas impagas cuyo vencimiento ya pasó.
// Protegido por CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>" automáticamente
// en las invocaciones de cron cuando la variable de entorno está configurada.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: any, res: any) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers?.authorization !== `Bearer ${secret}`) {
        res.status(401).json({ error: 'No autorizado' });
        return;
    }

    try {
        const ahora = new Date();
        const { count } = await prisma.cuota.updateMany({
            where: {
                vence: { lt: ahora },
                pagada: false,
                vencida: false, // sólo las que aún no estén marcadas
            },
            data: { vencida: true },
        });
        res.status(200).json({ ok: true, cuotasVencidas: count });
    } catch (err: any) {
        console.error('[cron/checkVencidas]', err);
        res.status(500).json({ ok: false, error: err.message });
    } finally {
        await prisma.$disconnect();
    }
}
