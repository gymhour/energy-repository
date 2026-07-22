import prisma from "../models/Prisma.js";
import { sendBirthdayEmail } from "./email.service.js";

const TIMEZONE = process.env.TIMEZONE || "America/Argentina/Cordoba";

function getMonthDayFromDate(d: Date, timeZone = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(d);
  return {
    month: Number(parts.find((p) => p.type === "month")!.value),
    day: Number(parts.find((p) => p.type === "day")!.value),
  };
}

// Marca como vencidas las cuotas impagas cuyo vencimiento ya pasó.
export async function checkVencidas(): Promise<number> {
  const ahora = new Date();
  const { count } = await prisma.cuota.updateMany({
    where: { vence: { lt: ahora }, pagada: false, vencida: false },
    data: { vencida: true },
  });
  return count;
}

// Marca AUSENTE los turnos ACTIVOS pasados sin asistencia.
export async function marcarAusentes(): Promise<number> {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(23, 59, 59, 999);
  const { count } = await prisma.turno.updateMany({
    where: { estado: "ACTIVO", fecha: { lte: ayer }, Asistencias: { none: {} } },
    data: { estado: "AUSENTE" },
  });
  return count;
}

// Envía emails de cumpleaños del día (best-effort, una falla no frena al resto).
export async function sendBirthdayEmails(): Promise<number> {
  const { month, day } = getMonthDayFromDate(new Date());
  const usuarios = await prisma.user.findMany({
    where: { fechaCumple: { not: null } },
    select: { ID_Usuario: true, email: true, nombre: true, fechaCumple: true },
  });
  let sent = 0;
  for (const u of usuarios) {
    try {
      if (!u.fechaCumple) continue;
      const f = new Date(u.fechaCumple);
      if (f.getUTCMonth() + 1 === month && f.getUTCDate() === day) {
        await sendBirthdayEmail(u.email, u.nombre ?? "");
        sent += 1;
      }
    } catch (e) {
      console.error("[nightly] error enviando cumpleaños a usuario", u.ID_Usuario, e);
    }
  }
  return sent;
}

// Ejecuta las 3 tareas nocturnas. Cada una con su try/catch para que una falla no frene las demás.
export async function runNightlyTasks(): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  try {
    result.cuotasVencidas = await checkVencidas();
  } catch (e: any) {
    result.cuotasVencidasError = e?.message ?? String(e);
    console.error("[nightly] checkVencidas", e);
  }
  try {
    result.turnosAusentes = await marcarAusentes();
  } catch (e: any) {
    result.turnosAusentesError = e?.message ?? String(e);
    console.error("[nightly] marcarAusentes", e);
  }
  try {
    result.cumpleEnviados = await sendBirthdayEmails();
  } catch (e: any) {
    result.cumpleError = e?.message ?? String(e);
    console.error("[nightly] sendBirthdayEmails", e);
  }
  return result;
}
