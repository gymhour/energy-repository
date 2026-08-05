// Auditoría READ-ONLY de horarios, turnos fijos y turnos.
// No escribe absolutamente nada: sólo lee y reporta.
//
// Sirve para sacar la foto ANTES y DESPUÉS de correr consolidarSlotsHorarios.js
// y comparar qué se arregló:
//
//   node prisma/auditarSlotsHorarios.js --json > /tmp/audit-antes.json
//   node prisma/consolidarSlotsHorarios.js --apply
//   node prisma/auditarSlotsHorarios.js --json > /tmp/audit-despues.json
//   diff <(jq .resumen /tmp/audit-antes.json) <(jq .resumen /tmp/audit-despues.json)
//
// Uso:
//   node prisma/auditarSlotsHorarios.js              -> reporte legible
//   node prisma/auditarSlotsHorarios.js --json       -> JSON completo (para diff)
//   node prisma/auditarSlotsHorarios.js --detalle=50 -> más filas por chequeo (default 10)
//
// Qué esperar después de consolidar:
//   - B5 y B6 deben quedar en CERO (no debe colgar nada de un horario desactivado).
//   - C7 y D14 deben quedar en CERO (una sesión = un solo registro con datos).
//   - A1 y A2 NO cambian: los HorarioClase viejos siguen existiendo, vacíos. Es esperado.
//   - C11 (sobreasignación) NO se corrige sola: la resuelve el admin a mano.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JSON_OUT = process.argv.includes("--json");
const DETALLE = Number(
  (process.argv.find((a) => a.startsWith("--detalle=")) || "--detalle=10").split("=")[1]
) || 10;

/* ------------------------------------------------------------------ helpers */

// Mismas convenciones que accessRules.service.ts: el día se compara sin acentos y la
// hora de los horarios/turnos se guarda como "hora de pared" en UTC.
const normalizeDayKey = (value) => (
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
);

const wallClockKey = (date) => {
  const iso = new Date(date).toISOString();
  return `${iso.slice(11, 13)}:${iso.slice(14, 16)}`;
};

const buildSlotKey = (horario) => (
  `${horario.ID_Clase}|${normalizeDayKey(horario.diaSemana)}|${wallClockKey(horario.horaIni)}`
);

const ESTADOS_ACTIVOS = ["ACTIVO", "ASISTIDO", "AUSENTE"];
const getArgentinaDate = () => new Date(Date.now() - 3 * 60 * 60 * 1000);

const fechaLegible = (fecha) => {
  const iso = new Date(fecha).toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
};

const diaCalendario = (fecha) => new Date(fecha).toISOString().slice(0, 10);

const nombreUsuario = (user, id) => (
  `${user?.nombre ?? ""} ${user?.apellido ?? ""}`.trim() || `ID ${id}`
);

/* -------------------------------------------------------------- resultados */

const chequeos = [];

const registrar = (codigo, titulo, filas, { gravedad = "aviso", esperado = null, nota = null } = {}) => {
  chequeos.push({ codigo, titulo, gravedad, esperado, nota, cantidad: filas.length, filas });
};

/* ------------------------------------------------------------------- main */

async function main() {
  const ahora = getArgentinaDate();

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

  const fijos = await prisma.turnoFijo.findMany({
    where: { activo: true },
    select: {
      ID_TurnoFijo: true,
      ID_Usuario: true,
      ID_HorarioClase: true,
      User: {
        select: { nombre: true, apellido: true, estado: true, usaTurnosFijos: true },
      },
    },
  });

  const turnos = await prisma.turno.findMany({
    select: {
      id_turno: true,
      ID_Usuario: true,
      ID_HorarioClase: true,
      fecha: true,
      estado: true,
      User: { select: { nombre: true, apellido: true, estado: true } },
    },
  });

  const cuotas = await prisma.cuota.findMany({
    where: { fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
    select: { ID_Usuario: true },
  });
  const conCuotaVigente = new Set(cuotas.map((c) => c.ID_Usuario));

  // Índices --------------------------------------------------------------
  const horarioById = new Map(horarios.map((h) => [h.ID_HorarioClase, h]));

  const slots = new Map(); // slotKey -> { horarios[], vigente, obsoletos[], nombre }
  for (const horario of horarios) {
    const key = buildSlotKey(horario);
    if (!slots.has(key)) slots.set(key, { key, horarios: [] });
    slots.get(key).horarios.push(horario);
  }
  for (const slot of slots.values()) {
    const activos = slot.horarios
      .filter((h) => h.activo)
      .sort((a, b) => b.ID_HorarioClase - a.ID_HorarioClase);
    slot.activos = activos;
    slot.vigente = activos[0] ?? null;
    slot.obsoletos = slot.horarios.filter((h) => h.ID_HorarioClase !== slot.vigente?.ID_HorarioClase);
    const ref = slot.vigente ?? slot.horarios[0];
    slot.nombre = `${ref.Clase?.nombre ?? `clase ${ref.ID_Clase}`} · ${ref.diaSemana} ${wallClockKey(ref.horaIni)}`;
  }

  const slotKeyByHorario = new Map();
  for (const slot of slots.values()) {
    for (const h of slot.horarios) slotKeyByHorario.set(h.ID_HorarioClase, slot.key);
  }
  const slotDe = (idHorario) => slots.get(slotKeyByHorario.get(idHorario));

  /* ============================ A. ESTRUCTURA DE HORARIOS ============================ */

  // A1 — Slots repartidos en más de un HorarioClase. Informativo: los registros viejos
  // siguen existiendo después de consolidar (vacíos). No debería crecer con el tiempo.
  registrar("A1", "Slots repartidos en más de un HorarioClase",
    [...slots.values()]
      .filter((s) => s.horarios.length > 1)
      .map((s) => ({
        slot: s.nombre,
        vigente: s.vigente?.ID_HorarioClase ?? null,
        registros: s.horarios.map((h) => ({
          ID_HorarioClase: h.ID_HorarioClase,
          cupos: h.cupos,
          activo: h.activo,
        })),
      })),
    { gravedad: "info", nota: "No baja a cero al consolidar: los registros viejos quedan, pero vacíos." });

  // A2 — Hermanos con cupos distintos al vigente: ES la causa del bug de generación de
  // cuotas (la capacidad se leía del registro equivocado).
  registrar("A2", "Hermanos con cupos distintos a los del horario vigente",
    [...slots.values()]
      .filter((s) => s.vigente)
      .flatMap((s) => s.obsoletos
        .filter((h) => Number(h.cupos) !== Number(s.vigente.cupos))
        .map((h) => ({
          slot: s.nombre,
          ID_HorarioClase: h.ID_HorarioClase,
          cuposRegistro: h.cupos,
          cuposVigente: s.vigente.cupos,
          activo: h.activo,
        }))),
    { gravedad: "info", nota: "Explica por qué la capacidad se leía mal. No hace falta corregir el dato viejo." });

  // A3 — Slots sin ningún horario activo: nadie puede agendar esa sesión.
  registrar("A3", "Slots sin ningún horario activo",
    [...slots.values()]
      .filter((s) => !s.vigente)
      .map((s) => ({
        slot: s.nombre,
        registros: s.horarios.map((h) => h.ID_HorarioClase),
      })),
    { gravedad: "grave", esperado: 0 });

  // A4 — Dos o más horarios ACTIVOS para la misma sesión: ambigüedad real, el sistema
  // elige el de mayor ID y el otro queda invisible pero vivo.
  registrar("A4", "Slots con más de un horario ACTIVO",
    [...slots.values()]
      .filter((s) => s.activos.length > 1)
      .map((s) => ({
        slot: s.nombre,
        activos: s.activos.map((h) => ({ ID_HorarioClase: h.ID_HorarioClase, cupos: h.cupos })),
      })),
    { gravedad: "grave", esperado: 0 });

  /* ================= B. DATOS COLGANDO DE HORARIOS DESACTIVADOS ================= */
  // Estos dos son EL indicador de que consolidarSlotsHorarios.js hizo su trabajo.

  const horariosInactivos = horarios.filter((h) => !h.activo);

  // B5 — Turnos fijos activos apuntando a un horario desactivado.
  registrar("B5", "Turnos fijos activos sobre horarios DESACTIVADOS",
    horariosInactivos
      .map((h) => {
        const delHorario = fijos.filter((f) => f.ID_HorarioClase === h.ID_HorarioClase);
        if (delHorario.length === 0) return null;
        const slot = slotDe(h.ID_HorarioClase);
        return {
          ID_HorarioClase: h.ID_HorarioClase,
          slot: slot?.nombre ?? `clase ${h.ID_Clase} ${h.diaSemana} ${wallClockKey(h.horaIni)}`,
          vigente: slot?.vigente?.ID_HorarioClase ?? null,
          fijos: delHorario.length,
          alumnos: delHorario.map((f) => nombreUsuario(f.User, f.ID_Usuario)).sort(),
        };
      })
      .filter(Boolean),
    { gravedad: "grave", esperado: 0, nota: "Debe quedar en CERO después de consolidar." });

  // B6 — Turnos futuros colgando de un horario desactivado.
  // Se cuentan TODOS los estados (incluidos los cancelados), igual que consolidarSlotsHorarios.js,
  // para que el total de este chequeo coincida con el que reporta el dry-run.
  const turnosFuturos = turnos.filter((t) => new Date(t.fecha) >= ahora);
  registrar("B6", "Turnos futuros sobre horarios DESACTIVADOS",
    horariosInactivos
      .map((h) => {
        const delHorario = turnosFuturos.filter((t) => t.ID_HorarioClase === h.ID_HorarioClase);
        if (delHorario.length === 0) return null;
        const slot = slotDe(h.ID_HorarioClase);
        return {
          ID_HorarioClase: h.ID_HorarioClase,
          slot: slot?.nombre ?? `clase ${h.ID_Clase}`,
          vigente: slot?.vigente?.ID_HorarioClase ?? null,
          turnos: delHorario.length,
          noCancelados: delHorario.filter((t) => t.estado !== "CANCELADO").length,
          desde: fechaLegible(delHorario.map((t) => t.fecha).sort((a, b) => new Date(a) - new Date(b))[0]),
        };
      })
      .filter(Boolean),
    { gravedad: "grave", esperado: 0, nota: "Debe quedar en CERO después de consolidar. 'turnos' incluye cancelados: coincide con el dry-run." });

  /* ============================== C. TURNOS FIJOS ============================== */

  // C7 — Un alumno con dos turnos fijos en hermanos del mismo slot: ocuparía dos lugares
  // de la misma sesión y generaría dos turnos por fecha.
  const fijosPorUsuarioSlot = new Map();
  for (const f of fijos) {
    const key = `${f.ID_Usuario}|${slotKeyByHorario.get(f.ID_HorarioClase)}`;
    if (!fijosPorUsuarioSlot.has(key)) fijosPorUsuarioSlot.set(key, []);
    fijosPorUsuarioSlot.get(key).push(f);
  }
  registrar("C7", "Alumnos con 2+ turnos fijos en el MISMO slot",
    [...fijosPorUsuarioSlot.values()]
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => ({
        alumno: nombreUsuario(grupo[0].User, grupo[0].ID_Usuario),
        ID_Usuario: grupo[0].ID_Usuario,
        slot: slotDe(grupo[0].ID_HorarioClase)?.nombre,
        horarios: grupo.map((f) => f.ID_HorarioClase),
      })),
    { gravedad: "grave", esperado: 0, nota: "Debe quedar en CERO después de consolidar." });

  // C8 — Dos turnos fijos el mismo día de la semana: lo prohíbe assertNoDuplicateFixedDays,
  // pero datos viejos pueden violarlo.
  const fijosPorUsuarioDia = new Map();
  for (const f of fijos) {
    const horario = horarioById.get(f.ID_HorarioClase);
    if (!horario) continue;
    const key = `${f.ID_Usuario}|${normalizeDayKey(horario.diaSemana)}`;
    if (!fijosPorUsuarioDia.has(key)) fijosPorUsuarioDia.set(key, []);
    fijosPorUsuarioDia.get(key).push({ fijo: f, horario });
  }
  registrar("C8", "Alumnos con 2+ turnos fijos el mismo día de la semana",
    [...fijosPorUsuarioDia.values()]
      .filter((grupo) => new Set(grupo.map((g) => slotKeyByHorario.get(g.fijo.ID_HorarioClase))).size > 1)
      .map((grupo) => ({
        alumno: nombreUsuario(grupo[0].fijo.User, grupo[0].fijo.ID_Usuario),
        ID_Usuario: grupo[0].fijo.ID_Usuario,
        dia: grupo[0].horario.diaSemana,
        sesiones: grupo.map((g) => `${wallClockKey(g.horario.horaIni)} (h${g.horario.ID_HorarioClase})`),
      })),
    { gravedad: "aviso", nota: "Viola la regla de un turno fijo por día. No lo toca el consolidador." });

  // C9 — Fijos activos de alumnos dados de baja o que no usan turnos fijos: reservan cupo
  // que nunca se materializa.
  registrar("C9", "Turnos fijos activos de alumnos inactivos o sin 'usaTurnosFijos'",
    fijos
      .filter((f) => f.User && (f.User.estado !== true || f.User.usaTurnosFijos !== true))
      .map((f) => ({
        alumno: nombreUsuario(f.User, f.ID_Usuario),
        ID_Usuario: f.ID_Usuario,
        ID_HorarioClase: f.ID_HorarioClase,
        slot: slotDe(f.ID_HorarioClase)?.nombre,
        motivo: f.User.estado !== true ? "alumno inactivo" : "usaTurnosFijos = false",
      })),
    { gravedad: "grave", esperado: 0, nota: "Lo resuelve limpiarBajasPendientes.js. Desde el fix, la baja las desactiva sola." });

  // C10 — Fijos de alumnos sin cuota vigente hoy. Informativo: es normal entre cuotas,
  // el cálculo de cupos ya los ignora.
  registrar("C10", "Turnos fijos activos de alumnos sin cuota vigente hoy",
    fijos
      .filter((f) => !conCuotaVigente.has(f.ID_Usuario))
      .map((f) => ({
        alumno: nombreUsuario(f.User, f.ID_Usuario),
        ID_Usuario: f.ID_Usuario,
        slot: slotDe(f.ID_HorarioClase)?.nombre,
      })),
    { gravedad: "info", nota: "Normal entre cuotas. El cálculo de cupos ya no les reserva lugar." });

  // C11 — Más alumnos con fijo que cupos: sobreasignación real, la resuelve el admin.
  // Sólo cuentan las plantillas que se van a materializar: la de un alumno dado de baja o
  // con usaTurnosFijos apagado nunca genera un turno, así que no retiene un asiento.
  // El sistema aplica el mismo criterio al validar altas de turnos fijos.
  const fijoCuenta = (f) => f.User?.estado === true && f.User?.usaTurnosFijos === true;
  registrar("C11", "Slots con MÁS turnos fijos que cupos",
    [...slots.values()]
      .filter((s) => s.vigente)
      .map((s) => {
        const hermanos = new Set(s.horarios.map((h) => h.ID_HorarioClase));
        const alumnos = new Map();
        const fantasma = new Map();
        for (const f of fijos) {
          if (!hermanos.has(f.ID_HorarioClase)) continue;
          const destino = fijoCuenta(f) ? alumnos : fantasma;
          destino.set(f.ID_Usuario, nombreUsuario(f.User, f.ID_Usuario));
        }
        const cupos = Number(s.vigente.cupos ?? 0);
        if (alumnos.size <= cupos) return null;
        return {
          slot: s.nombre,
          cupos,
          fijos: alumnos.size,
          sobran: alumnos.size - cupos,
          fijosDeAlumnosDeBaja: fantasma.size,
          alumnos: [...alumnos.values()].sort(),
        };
      })
      .filter(Boolean),
    { gravedad: "grave", nota: "NO se corrige solo: hay que decidir a mano quién se mueve de horario. Excluye plantillas de alumnos de baja (ver C9)." });

  /* ================================= D. TURNOS ================================= */

  const turnosNoCancelados = turnos.filter((t) => t.estado !== "CANCELADO");

  // D12 — Dos turnos del mismo alumno para la misma sesión y fecha: consume dos lugares.
  // (No hay índice único en la tabla, así que skipDuplicates no protege.)
  const turnosPorUsuarioSlotFecha = new Map();
  for (const t of turnosNoCancelados) {
    const key = `${t.ID_Usuario}|${slotKeyByHorario.get(t.ID_HorarioClase)}|${new Date(t.fecha).getTime()}`;
    if (!turnosPorUsuarioSlotFecha.has(key)) turnosPorUsuarioSlotFecha.set(key, []);
    turnosPorUsuarioSlotFecha.get(key).push(t);
  }
  registrar("D12", "Alumnos con 2+ turnos no cancelados en la misma sesión y fecha",
    [...turnosPorUsuarioSlotFecha.values()]
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => ({
        alumno: nombreUsuario(grupo[0].User, grupo[0].ID_Usuario),
        ID_Usuario: grupo[0].ID_Usuario,
        slot: slotDe(grupo[0].ID_HorarioClase)?.nombre,
        fecha: fechaLegible(grupo[0].fecha),
        turnos: grupo.map((t) => ({ id_turno: t.id_turno, ID_HorarioClase: t.ID_HorarioClase, estado: t.estado })),
      })),
    { gravedad: "grave", nota: "Duplicados reales. Hay que cancelar/borrar uno de los dos a mano." });

  // D13 — Fechas futuras con más turnos activos que cupos del vigente: sobrecupo real,
  // más gente anotada que lugares.
  const turnosFuturosActivos = turnos.filter((t) => (
    new Date(t.fecha) >= ahora && ESTADOS_ACTIVOS.includes(t.estado)
  ));
  const ocupacionPorSlotFecha = new Map();
  for (const t of turnosFuturosActivos) {
    const key = `${slotKeyByHorario.get(t.ID_HorarioClase)}|${new Date(t.fecha).getTime()}`;
    if (!ocupacionPorSlotFecha.has(key)) ocupacionPorSlotFecha.set(key, []);
    ocupacionPorSlotFecha.get(key).push(t);
  }
  registrar("D13", "Fechas futuras con MÁS turnos activos que cupos",
    [...ocupacionPorSlotFecha.values()]
      .map((grupo) => {
        const slot = slotDe(grupo[0].ID_HorarioClase);
        const cupos = Number(slot?.vigente?.cupos ?? 0);
        const alumnos = new Set(grupo.map((t) => t.ID_Usuario));
        if (!slot?.vigente || alumnos.size <= cupos) return null;
        return {
          slot: slot.nombre,
          fecha: fechaLegible(grupo[0].fecha),
          cupos,
          ocupados: alumnos.size,
          exceso: alumnos.size - cupos,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.exceso - a.exceso),
    { gravedad: "grave", nota: "Más alumnos anotados que lugares. Requiere resolución manual." });

  // D14 — Una misma sesión futura con turnos repartidos en varios hermanos.
  registrar("D14", "Sesiones futuras con turnos repartidos en varios horarios hermanos",
    [...ocupacionPorSlotFecha.values()]
      .map((grupo) => {
        const usados = new Set(grupo.map((t) => t.ID_HorarioClase));
        if (usados.size <= 1) return null;
        const slot = slotDe(grupo[0].ID_HorarioClase);
        return {
          slot: slot?.nombre,
          fecha: fechaLegible(grupo[0].fecha),
          horarios: [...usados].sort((a, b) => a - b),
          turnos: grupo.length,
        };
      })
      .filter(Boolean),
    { gravedad: "grave", esperado: 0, nota: "Debe quedar en CERO después de consolidar." });

  // D15 — Dos turnos activos el mismo día calendario: lo prohíbe hasTurnoSameDay.
  const turnosPorUsuarioDia = new Map();
  for (const t of turnosFuturosActivos) {
    const key = `${t.ID_Usuario}|${diaCalendario(t.fecha)}`;
    if (!turnosPorUsuarioDia.has(key)) turnosPorUsuarioDia.set(key, []);
    turnosPorUsuarioDia.get(key).push(t);
  }
  registrar("D15", "Alumnos con 2+ turnos futuros activos el mismo día calendario",
    [...turnosPorUsuarioDia.values()]
      .filter((grupo) => grupo.length > 1)
      .map((grupo) => ({
        alumno: nombreUsuario(grupo[0].User, grupo[0].ID_Usuario),
        ID_Usuario: grupo[0].ID_Usuario,
        dia: diaCalendario(grupo[0].fecha),
        turnos: grupo.map((t) => ({ id_turno: t.id_turno, hora: wallClockKey(t.fecha), estado: t.estado })),
      })),
    { gravedad: "aviso", nota: "Viola la regla de un turno por día." });

  // D16 — Turnos futuros activos de alumnos dados de baja: retienen un cupo que nadie va
  // a usar. Desde el fix, dar de baja los cancela solo; los viejos los limpia el script.
  registrar("D16", "Turnos futuros activos de alumnos dados de baja",
    turnosFuturosActivos
      .filter((t) => t.User?.estado !== true)
      .map((t) => ({
        alumno: nombreUsuario(t.User, t.ID_Usuario),
        ID_Usuario: t.ID_Usuario,
        id_turno: t.id_turno,
        slot: slotDe(t.ID_HorarioClase)?.nombre,
        fecha: fechaLegible(t.fecha),
      })),
    { gravedad: "grave", esperado: 0, nota: "Lo resuelve limpiarBajasPendientes.js. Desde el fix, la baja los cancela sola." });

  /* ================================= SALIDA ================================= */

  const resumen = Object.fromEntries(chequeos.map((c) => [c.codigo, c.cantidad]));
  const contexto = {
    fecha: new Date().toISOString(),
    horarios: horarios.length,
    horariosActivos: horarios.filter((h) => h.activo).length,
    horariosInactivos: horariosInactivos.length,
    slots: slots.size,
    turnosFijosActivos: fijos.length,
    turnos: turnos.length,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify({ contexto, resumen, chequeos }, null, 2));
    return;
  }

  const ICONO = { grave: "❌", aviso: "⚠️ ", info: "ℹ️ " };

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUDITORÍA DE HORARIOS Y TURNOS (read-only)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  ${contexto.horarios} horarios (${contexto.horariosActivos} activos, ${contexto.horariosInactivos} desactivados) en ${contexto.slots} slots`);
  console.log(`  ${contexto.turnosFijosActivos} turnos fijos activos · ${contexto.turnos} turnos`);

  for (const chequeo of chequeos) {
    const ok = chequeo.cantidad === 0;
    const icono = ok ? "✅" : ICONO[chequeo.gravedad];
    console.log(`\n${icono} ${chequeo.codigo} · ${chequeo.titulo}: ${chequeo.cantidad}`);
    if (chequeo.nota) console.log(`     ${chequeo.nota}`);

    for (const fila of chequeo.filas.slice(0, DETALLE)) {
      console.log(`     · ${JSON.stringify(fila)}`);
    }
    if (chequeo.filas.length > DETALLE) {
      console.log(`     … y ${chequeo.filas.length - DETALLE} más (usá --detalle=${chequeo.filas.length} o --json)`);
    }
  }

  const debenSerCero = chequeos.filter((c) => c.esperado === 0);
  const pendientes = debenSerCero.filter((c) => c.cantidad > 0);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESUMEN");
  console.log("═══════════════════════════════════════════════════════════════");
  for (const c of chequeos) {
    const marca = c.cantidad === 0 ? "✅" : ICONO[c.gravedad];
    console.log(`  ${marca} ${c.codigo}: ${String(c.cantidad).padStart(4)}  ${c.titulo}`);
  }

  console.log("");
  if (pendientes.length === 0) {
    console.log("  ✅ Todos los chequeos que deben dar CERO están en cero.");
  } else {
    console.log(`  ❌ ${pendientes.length} chequeo(s) que deberían dar CERO no lo están:`);
    for (const c of pendientes) console.log(`       ${c.codigo} (${c.cantidad}) · ${c.titulo}`);
    console.log("     Si todavía no corriste consolidarSlotsHorarios.js --apply, es lo esperado.");
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("Error auditando:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
