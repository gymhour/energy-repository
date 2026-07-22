import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export default async function handler(req: any, res: any) {
  try {
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);
    ayer.setHours(23, 59, 59, 999);

    const { count } = await prisma.turno.updateMany({
      where: {
        estado: 'ACTIVO',
        fecha: { lte: ayer },
        Asistencias: { none: {} },
      },
      data: {
        estado: 'AUSENTE',
      },
    });

    res.status(200).json({ updated: count });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await prisma.$disconnect();
  }
}
