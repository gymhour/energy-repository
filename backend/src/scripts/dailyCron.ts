// Entrypoint del servicio de CRON de Railway. Corre 1 vez por día, ejecuta todas las
// tareas programadas y termina.
//
// Railway exige que el proceso SALGA al terminar: si queda vivo, la corrida siguiente se saltea.
// Por eso importamos los servicios directamente y nunca `app.ts` (que hace app.listen).
//
// Reemplaza a los dos crons de Vercel (`api/cron/checkVencidas` + `api/cron/daily`):
//   runNightlyTasks   -> cuotas vencidas · turnos ausentes · mails de cumpleaños
//   runReminderTasks  -> mails: turno de hoy · cuota que vence en 3 días · inactividad 15 días
//
// ⚠️ Las tareas de mail NO son idempotentes: cada corrida vuelve a enviar. Correr 1 vez por día.
import 'dotenv/config'; // ANTES de todo: email.service lee SMTP_* a nivel de módulo
import prisma from '../models/Prisma.js';
import { runNightlyTasks } from '../services/nightly.service.js';
import { runReminderTasks } from '../services/reminders.service.js';

async function main(): Promise<number> {
    const inicio = Date.now();
    console.log('[cron] inicio', new Date().toISOString());

    // Cada helper ya aísla sus sub-tareas con try/catch: una falla no frena las demás.
    const nightly = await runNightlyTasks();
    const reminders = await runReminderTasks();

    const resultado = { ...nightly, ...reminders };
    const errores = Object.keys(resultado).filter((k) => k.endsWith('Error'));

    console.log('[cron] resultado', JSON.stringify(resultado, null, 2));
    console.log(`[cron] fin en ${Date.now() - inicio}ms`);
    return errores.length;
}

main()
    .then(async (errores) => {
        await prisma.$disconnect();
        process.exit(errores > 0 ? 1 : 0); // exit≠0 -> Railway marca la corrida como fallida
    })
    .catch(async (e) => {
        console.error('[cron] fallo fatal', e);
        await prisma.$disconnect();
        process.exit(1);
    });
