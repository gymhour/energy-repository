// Consolida los "slots fragmentados": una misma sesión (clase + día + hora de inicio)
// repartida en varios HorarioClase porque una edición en modo "preserve" creó un registro
// nuevo y desactivó el viejo.
//
// Para cada horario desactivado que tenga un hermano vigente:
//   - mueve sus TurnoFijo activos al vigente (si el alumno ya tiene fijo ahí, borra el duplicado);
//   - mueve sus Turno con fecha >= hoy al vigente (los pasados quedan como historia real).
//
// Al final reporta los slots que quedan con más turnos fijos que cupos: esos NO se tocan,
// los resuelve el admin a mano decidiendo quién se mueve.
//
// Uso:
//   node prisma/consolidarSlotsHorarios.js            -> dry-run, no escribe nada
//   node prisma/consolidarSlotsHorarios.js --apply    -> aplica los cambios
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const normalizeDayKey = (value) => (
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
);

// Los horarios guardan "hora de pared" en UTC (misma convención que accessRules.service.ts).
const wallClockKey = (date) => {
  const iso = new Date(date).toISOString();
  return `${iso.slice(11, 13)}:${iso.slice(14, 16)}`;
};

// "Ahora" en el mismo marco wall-clock que la columna fecha de Turno (getArgentinaDate).
// Con new Date() a secas, los turnos de las próximas 3 horas quedarían del lado del pasado.
const getArgentinaDate = () => new Date(Date.now() - 3 * 60 * 60 * 1000);

const buildSlotKey = (horario) => (
  `${horario.ID_Clase}|${normalizeDayKey(horario.diaSemana)}|${wallClockKey(horario.horaIni)}`
);

const describeSlot = (horario, claseNombre) => (
  `${claseNombre ?? `clase ${horario.ID_Clase}`} · ${horario.diaSemana} ${wallClockKey(horario.horaIni)}`
);

async function main() {
  console.log(APPLY
    ? "⚙️   Consolidando slots fragmentados (APLICANDO cambios)..."
    : "🔍  Consolidando slots fragmentados (DRY-RUN, no se escribe nada). Usá --apply para aplicar.");

  const horarios = await prisma.horarioClase.findMany({
    select: {
      ID_HorarioClase: true,
      ID_Clase: true,
      diaSemana: true,
      horaIni: true,
      cupos: true,
      activo: true,
      Clase: { select: { nombre: true } },
    },
    orderBy: { ID_HorarioClase: "asc" },
  });

  const slots = new Map();
  for (const horario of horarios) {
    const key = buildSlotKey(horario);
    const group = slots.get(key);
    if (group) group.push(horario);
    else slots.set(key, [horario]);
  }

  const ahora = getArgentinaDate();
  let fijosMovidos = 0;
  let fijosDuplicadosBorrados = 0;
  let turnosMovidos = 0;
  let slotsTocados = 0;
  const sobreasignados = [];

  for (const [slotKey, grupo] of slots) {
    // El vigente es el activo de mayor ID (mismo criterio que selectCurrentSlotHorario).
    const vigente = grupo
      .filter((h) => h.activo)
      .sort((a, b) => b.ID_HorarioClase - a.ID_HorarioClase)[0];
    const obsoletos = grupo.filter((h) => vigente && h.ID_HorarioClase !== vigente.ID_HorarioClase);

    if (!vigente) {
      if (grupo.length > 0) {
        console.log(`⚠️   ${slotKey}: sin horario activo (${grupo.length} registro(s)). Se omite: no hay destino.`);
      }
      continue;
    }

    const nombreSlot = describeSlot(vigente, vigente.Clase?.nombre);

    if (obsoletos.length > 0) {
      slotsTocados += 1;
      console.log(`\n📌  ${nombreSlot} -> horario vigente ${vigente.ID_HorarioClase} (cupos ${vigente.cupos})`);
    }

    for (const obsoleto of obsoletos) {
      // --- Turnos fijos ---
      const fijos = await prisma.turnoFijo.findMany({
        where: { ID_HorarioClase: obsoleto.ID_HorarioClase, activo: true },
        select: { ID_TurnoFijo: true, ID_Usuario: true },
      });

      if (fijos.length > 0) {
        const yaEnVigente = await prisma.turnoFijo.findMany({
          where: {
            ID_HorarioClase: vigente.ID_HorarioClase,
            ID_Usuario: { in: fijos.map((f) => f.ID_Usuario) },
          },
          select: { ID_Usuario: true },
        });
        const duplicados = new Set(yaEnVigente.map((f) => f.ID_Usuario));

        const aMover = fijos.filter((f) => !duplicados.has(f.ID_Usuario));
        const aBorrar = fijos.filter((f) => duplicados.has(f.ID_Usuario));

        console.log(`    horario ${obsoleto.ID_HorarioClase} (cupos ${obsoleto.cupos}, inactivo): ${aMover.length} fijo(s) a mover, ${aBorrar.length} duplicado(s) a borrar`);

        if (APPLY && aMover.length > 0) {
          await prisma.turnoFijo.updateMany({
            where: { ID_TurnoFijo: { in: aMover.map((f) => f.ID_TurnoFijo) } },
            data: { ID_HorarioClase: vigente.ID_HorarioClase },
          });
        }
        if (APPLY && aBorrar.length > 0) {
          await prisma.turnoFijo.deleteMany({
            where: { ID_TurnoFijo: { in: aBorrar.map((f) => f.ID_TurnoFijo) } },
          });
        }
        fijosMovidos += aMover.length;
        fijosDuplicadosBorrados += aBorrar.length;
      }

      // --- Turnos futuros ---
      const turnosFuturos = await prisma.turno.count({
        where: { ID_HorarioClase: obsoleto.ID_HorarioClase, fecha: { gte: ahora } },
      });

      if (turnosFuturos > 0) {
        console.log(`    horario ${obsoleto.ID_HorarioClase}: ${turnosFuturos} turno(s) futuro(s) a mover`);
        if (APPLY) {
          await prisma.turno.updateMany({
            where: { ID_HorarioClase: obsoleto.ID_HorarioClase, fecha: { gte: ahora } },
            data: { ID_HorarioClase: vigente.ID_HorarioClase },
          });
        }
        turnosMovidos += turnosFuturos;
      }
    }

    // --- Chequeo de sobreasignación del slot (no se corrige: se reporta) ---
    // Sólo cuentan las plantillas que se van a materializar: la de un alumno dado de baja o
    // con usaTurnosFijos apagado nunca genera un turno. Es el mismo criterio que usa el
    // backend al validar altas de turnos fijos, y el del chequeo C11 de la auditoría.
    const fijosDelSlot = await prisma.turnoFijo.findMany({
      where: {
        ID_HorarioClase: { in: grupo.map((h) => h.ID_HorarioClase) },
        activo: true,
        User: { is: { estado: true, usaTurnosFijos: true } },
      },
      select: {
        ID_Usuario: true,
        User: { select: { nombre: true, apellido: true } },
      },
    });
    const alumnos = new Map();
    for (const fijo of fijosDelSlot) {
      const nombre = `${fijo.User?.nombre ?? ""} ${fijo.User?.apellido ?? ""}`.trim() || `ID ${fijo.ID_Usuario}`;
      alumnos.set(fijo.ID_Usuario, nombre);
    }

    if (alumnos.size > Number(vigente.cupos ?? 0)) {
      sobreasignados.push({
        slot: nombreSlot,
        cupos: Number(vigente.cupos ?? 0),
        fijos: alumnos.size,
        alumnos: Array.from(alumnos.values()).sort(),
      });
    }
  }

  console.log("\n──────────────────────────────────────────────");
  console.log(`Slots fragmentados encontrados: ${slotsTocados}`);
  console.log(`Turnos fijos movidos al vigente: ${fijosMovidos}`);
  console.log(`Turnos fijos duplicados borrados: ${fijosDuplicadosBorrados}`);
  console.log(`Turnos futuros movidos al vigente: ${turnosMovidos}`);

  if (sobreasignados.length > 0) {
    console.log(`\n⚠️   ${sobreasignados.length} slot(s) con MÁS turnos fijos que cupos.`);
    console.log("    El script no los toca: hay que decidir a mano quién se mueve de horario.\n");
    for (const s of sobreasignados) {
      console.log(`    ${s.slot}: ${s.fijos} fijos para ${s.cupos} cupos (sobran ${s.fijos - s.cupos})`);
      for (const alumno of s.alumnos) console.log(`      · ${alumno}`);
      console.log("");
    }
  } else {
    console.log("\n✅  Ningún slot queda con más turnos fijos que cupos.");
  }

  if (!APPLY) {
    console.log("\nDRY-RUN: no se escribió nada. Volvé a correrlo con --apply para aplicar.");
  }
}

main()
  .catch((error) => {
    console.error("Error consolidando slots:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
