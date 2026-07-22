// api/cron/daily.ts — CRON 2 de Vercel (Hobby permite 2 crons; el 1 es checkVencidas).
// Combina el resto de las tareas diarias en un único cron:
//   - marcarAusentes (turnos ACTIVOS pasados sin asistencia)
//   - emails de cumpleaños del día
//   - recordatorios: turno de hoy · cuota que vence en 3 días · inactividad de 15 días
// Reutiliza los servicios compilados (mismo patrón que api/index.ts importa dist/app.js).
// Cada tarea corre en su propio try/catch: una falla no frena a las demás.
// Protegido por CRON_SECRET: Vercel envía "Authorization: Bearer <CRON_SECRET>" automáticamente
// en las invocaciones de cron cuando la variable de entorno está configurada.
import { marcarAusentes, sendBirthdayEmails } from "../../dist/services/nightly.service.js";
import { runReminderTasks } from "../../dist/services/reminders.service.js";

export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers?.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const result: Record<string, unknown> = {};

  try {
    result.turnosAusentes = await marcarAusentes();
  } catch (e: any) {
    result.turnosAusentesError = e?.message ?? String(e);
    console.error("[cron/daily] marcarAusentes", e);
  }

  try {
    result.cumpleEnviados = await sendBirthdayEmails();
  } catch (e: any) {
    result.cumpleError = e?.message ?? String(e);
    console.error("[cron/daily] sendBirthdayEmails", e);
  }

  try {
    const reminders = await runReminderTasks();
    Object.assign(result, reminders);
  } catch (e: any) {
    result.remindersError = e?.message ?? String(e);
    console.error("[cron/daily] runReminderTasks", e);
  }

  res.status(200).json({ ok: true, ...result });
}
