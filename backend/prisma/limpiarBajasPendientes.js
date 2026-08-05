// Limpia lo que quedó colgando de alumnos dados de baja ANTES de que la baja liberara
// cupos automáticamente (hasta ese momento, estadoUser sólo cambiaba el estado del usuario:
// no cancelaba turnos ni desactivaba plantillas fijas).
//
// Hace dos cosas, con dos criterios distintos a propósito:
//
//   1. Desactiva TurnoFijo (activo -> false) de alumnos dados de baja O con usaTurnosFijos
//      apagado. Ninguna de esas plantillas se materializa nunca, así que sólo retienen cupo.
//      No las borra: queda el registro de lo que el alumno tenía.
//
//   2. Cancela los Turno futuros en estado ACTIVO SÓLO de alumnos dados de baja. Un alumno
//      activo con usaTurnosFijos apagado puede tener turnos manuales legítimos.
//
// Los turnos pasados (ASISTIDO/AUSENTE) no se tocan nunca: son historia real y alimentan
// asistencias, reportes y churn.
//
// Uso:
//   node prisma/limpiarBajasPendientes.js            -> dry-run, no escribe nada
//   node prisma/limpiarBajasPendientes.js --apply    -> aplica los cambios
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Mismo marco wall-clock que la columna fecha de Turno (getArgentinaDate en accessRules).
const getArgentinaDate = () => new Date(Date.now() - 3 * 60 * 60 * 1000);

const nombreUsuario = (user) => (
  `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim() || `ID ${user?.ID_Usuario}`
);

const motivoDe = (user) => (
  user.estado !== true ? "dado de baja" : "usaTurnosFijos apagado"
);

async function main() {
  console.log(APPLY
    ? "⚙️   Limpiando bajas pendientes (APLICANDO cambios)..."
    : "🔍  Limpiando bajas pendientes (DRY-RUN, no se escribe nada). Usá --apply para aplicar.");

  const ahora = getArgentinaDate();

  /* ---------------- 1. Turnos fijos que nunca se van a materializar ---------------- */

  const fijos = await prisma.turnoFijo.findMany({
    where: {
      activo: true,
      OR: [
        { User: { is: { estado: { not: true } } } },
        { User: { is: { usaTurnosFijos: false } } },
      ],
    },
    select: {
      ID_TurnoFijo: true,
      ID_Usuario: true,
      User: { select: { ID_Usuario: true, nombre: true, apellido: true, estado: true, usaTurnosFijos: true } },
      HorarioClase: {
        select: { diaSemana: true, horaIni: true, Clase: { select: { nombre: true } } },
      },
    },
    orderBy: { ID_Usuario: "asc" },
  });

  console.log(`\n── Turnos fijos a desactivar: ${fijos.length}`);
  const porUsuario = new Map();
  for (const fijo of fijos) {
    if (!porUsuario.has(fijo.ID_Usuario)) porUsuario.set(fijo.ID_Usuario, { user: fijo.User, items: [] });
    const hora = new Date(fijo.HorarioClase.horaIni).toISOString().slice(11, 16);
    porUsuario.get(fijo.ID_Usuario).items.push(
      `${fijo.HorarioClase.Clase?.nombre ?? "clase"} · ${fijo.HorarioClase.diaSemana} ${hora}`
    );
  }
  for (const { user, items } of porUsuario.values()) {
    console.log(`   ${nombreUsuario(user)} (${motivoDe(user)}): ${items.length}`);
    for (const item of items) console.log(`      · ${item}`);
  }

  if (APPLY && fijos.length > 0) {
    await prisma.turnoFijo.updateMany({
      where: { ID_TurnoFijo: { in: fijos.map((f) => f.ID_TurnoFijo) } },
      data: { activo: false },
    });
  }

  /* ---------------- 2. Turnos futuros de alumnos dados de baja ---------------- */

  const turnos = await prisma.turno.findMany({
    where: {
      estado: "ACTIVO",
      fecha: { gte: ahora },
      User: { is: { estado: { not: true } } },
    },
    select: {
      id_turno: true,
      fecha: true,
      ID_Usuario: true,
      User: { select: { ID_Usuario: true, nombre: true, apellido: true, estado: true } },
      HorarioClase: {
        select: { diaSemana: true, horaIni: true, Clase: { select: { nombre: true } } },
      },
    },
    orderBy: [{ ID_Usuario: "asc" }, { fecha: "asc" }],
  });

  console.log(`\n── Turnos futuros a cancelar: ${turnos.length}`);
  const turnosPorUsuario = new Map();
  for (const turno of turnos) {
    if (!turnosPorUsuario.has(turno.ID_Usuario)) turnosPorUsuario.set(turno.ID_Usuario, { user: turno.User, items: [] });
    const iso = new Date(turno.fecha).toISOString();
    turnosPorUsuario.get(turno.ID_Usuario).items.push(
      `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)} · ${turno.HorarioClase.Clase?.nombre ?? "clase"}`
    );
  }
  for (const { user, items } of turnosPorUsuario.values()) {
    console.log(`   ${nombreUsuario(user)}: ${items.length}`);
    for (const item of items) console.log(`      · ${item}`);
  }

  if (APPLY && turnos.length > 0) {
    await prisma.turno.updateMany({
      where: { id_turno: { in: turnos.map((t) => t.id_turno) } },
      data: { estado: "CANCELADO", canceladoEn: ahora },
    });
  }

  /* ---------------- Resumen ---------------- */

  console.log("\n──────────────────────────────────────────────");
  console.log(`Alumnos afectados: ${new Set([...porUsuario.keys(), ...turnosPorUsuario.keys()]).size}`);
  console.log(`Turnos fijos desactivados: ${fijos.length}`);
  console.log(`Turnos futuros cancelados: ${turnos.length}`);

  if (!APPLY) {
    console.log("\nDRY-RUN: no se escribió nada. Volvé a correrlo con --apply para aplicar.");
  }
}

main()
  .catch((error) => {
    console.error("Error limpiando bajas pendientes:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
