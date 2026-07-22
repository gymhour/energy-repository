import prisma from "../models/Prisma.js";
import {
  sendTurnoReminderEmail,
  sendCuotaPorVencerEmail,
  sendInactividadEmail,
} from "./email.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Inicio del día actual en UTC (los turnos/cuotas se guardan como wall-clock UTC,
// y el cron corre a media mañana, así que el día UTC coincide con el día local).
const startOfTodayUTC = (): Date => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

const fmtHora = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

// 1) Recordatorio de turnos del día (1 mail por alumno con todos sus turnos de hoy).
async function sendTurnoRemindersHoy(): Promise<number> {
  const hoy = startOfTodayUTC();
  const manana = new Date(hoy.getTime() + DAY_MS);

  const turnos = await prisma.turno.findMany({
    where: {
      estado: "ACTIVO",
      fecha: { gte: hoy, lt: manana },
      User: { is: { estado: true } },
    },
    include: {
      User: { select: { ID_Usuario: true, email: true, nombre: true } },
      HorarioClase: { select: { horaIni: true, horaFin: true, Clase: { select: { nombre: true } } } },
    },
    orderBy: { ID_HorarioClase: "asc" },
  });

  // Agrupar por usuario
  const byUser = new Map<number, { email: string; nombre: string; turnos: Array<{ clase: string; horario: string }> }>();
  for (const t of turnos) {
    if (!t.User?.email) continue;
    const entry = byUser.get(t.User.ID_Usuario) ?? {
      email: t.User.email,
      nombre: t.User.nombre ?? "",
      turnos: [],
    };
    entry.turnos.push({
      clase: t.HorarioClase?.Clase?.nombre ?? "Clase",
      horario: `${fmtHora(t.HorarioClase.horaIni)} - ${fmtHora(t.HorarioClase.horaFin)}`,
    });
    byUser.set(t.User.ID_Usuario, entry);
  }

  let sent = 0;
  for (const u of byUser.values()) {
    try {
      await sendTurnoReminderEmail(u.email, u.nombre, u.turnos);
      sent += 1;
    } catch (e) {
      console.error("[reminders] turno ->", u.email, e);
    }
  }
  return sent;
}

// 2) Recordatorio de cuota que vence exactamente en 3 días (impaga, alumno activo).
async function sendCuotaPorVencer3Dias(): Promise<number> {
  const hoy = startOfTodayUTC();
  const dia3 = new Date(hoy.getTime() + 3 * DAY_MS);
  const dia4 = new Date(hoy.getTime() + 4 * DAY_MS);

  const cuotas = await prisma.cuota.findMany({
    where: {
      pagada: false,
      vence: { gte: dia3, lt: dia4 },
      User: { is: { estado: true } },
    },
    include: { User: { select: { email: true, nombre: true } } },
  });

  let sent = 0;
  for (const c of cuotas) {
    if (!c.User?.email) continue;
    try {
      await sendCuotaPorVencerEmail(c.User.email, c.User.nombre ?? "", {
        vence: c.vence,
        importe: c.importe,
        mes: c.mes,
        diasRestantes: 3,
      });
      sent += 1;
    } catch (e) {
      console.error("[reminders] cuota ->", c.ID_Cuota, e);
    }
  }
  return sent;
}

// 3) Recordatorio de inactividad: última asistencia fue exactamente hace 15 días.
async function sendInactividad15Dias(): Promise<number> {
  const hoy = startOfTodayUTC();
  const target = new Date(hoy.getTime() - 15 * DAY_MS); // inicio del día de hace 15 días
  const targetEnd = new Date(target.getTime() + DAY_MS);

  const usuarios = await prisma.user.findMany({
    where: { estado: true, tipo: "cliente" },
    select: {
      email: true,
      nombre: true,
      Asistencias: {
        where: { permitido: true },
        orderBy: { fechaIngreso: "desc" },
        take: 1,
        select: { fechaIngreso: true },
      },
    },
  });

  let sent = 0;
  for (const u of usuarios) {
    const last = u.Asistencias[0]?.fechaIngreso;
    if (!last || !u.email) continue; // sin asistencias previas → se omite
    // ¿la última asistencia cae justo en el día de hace 15 días?
    if (last >= target && last < targetEnd) {
      try {
        await sendInactividadEmail(u.email, u.nombre ?? "", 15);
        sent += 1;
      } catch (e) {
        console.error("[reminders] inactividad ->", u.email, e);
      }
    }
  }
  return sent;
}

// Ejecuta las 3 tareas de recordatorio (cada una aislada: una falla no frena las demás).
export async function runReminderTasks(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  try {
    result.turnoReminders = await sendTurnoRemindersHoy();
  } catch (e: any) {
    result.turnoRemindersError = e?.message ?? String(e);
    console.error("[reminders] sendTurnoRemindersHoy", e);
  }
  try {
    result.cuotaReminders = await sendCuotaPorVencer3Dias();
  } catch (e: any) {
    result.cuotaRemindersError = e?.message ?? String(e);
    console.error("[reminders] sendCuotaPorVencer3Dias", e);
  }
  try {
    result.inactividadReminders = await sendInactividad15Dias();
  } catch (e: any) {
    result.inactividadRemindersError = e?.message ?? String(e);
    console.error("[reminders] sendInactividad15Dias", e);
  }
  return result;
}
