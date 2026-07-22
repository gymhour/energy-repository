// Backfill del log de movimientos de socios (altas/bajas) a partir de los datos actuales.
// Idempotente: sólo genera eventos para usuarios que todavía no tienen ninguno.
//   - 1 ALTA por usuario (con su fechaRegistro).
//   - 1 BAJA para los usuarios inactivos que tengan fechaBaja.
// Uso: node prisma/backfillMovimientos.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MOTIVO_BAJA_DEFAULT = "Otros / Sin motivo";

async function main() {
  console.log("🌱  Backfill de MovimientoSocio...");

  const usuarios = await prisma.user.findMany({
    select: {
      ID_Usuario: true,
      estado: true,
      fechaRegistro: true,
      fechaBaja: true,
      _count: { select: { movimientos: true } },
    },
  });

  const eventos = [];
  let saltados = 0;

  for (const u of usuarios) {
    if (u._count.movimientos > 0) {
      saltados += 1; // ya tiene historial, no lo tocamos
      continue;
    }

    // ALTA (con su fecha de registro, o ahora si no la tuviera)
    eventos.push({
      ID_Usuario: u.ID_Usuario,
      tipo: "ALTA",
      esReactivacion: false,
      fecha: u.fechaRegistro ?? new Date(),
    });

    // BAJA para inactivos con fecha de baja conocida
    if (u.estado === false && u.fechaBaja) {
      eventos.push({
        ID_Usuario: u.ID_Usuario,
        tipo: "BAJA",
        motivoBaja: MOTIVO_BAJA_DEFAULT,
        fecha: u.fechaBaja,
      });
    }
  }

  if (eventos.length > 0) {
    await prisma.movimientoSocio.createMany({ data: eventos });
  }

  console.log(`✅  Backfill completado. Eventos creados: ${eventos.length} · Usuarios saltados (ya tenían historial): ${saltados}`);
}

main()
  .catch((e) => {
    console.error("❌  Error en backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
