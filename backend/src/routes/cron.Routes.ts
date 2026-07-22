import express, { Request, Response } from "express";
import { runNightlyTasks } from "../services/nightly.service.js";
import { runReminderTasks } from "../services/reminders.service.js";

const cronRouter = express.Router();

// Protegido por CRON_SECRET (header: Authorization: Bearer <secret>).
// Se agenda desde hPanel -> Cron Jobs con, por ejemplo:
//   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<tu-api>/cron/nightly
const requireCronSecret = (req: Request, res: Response): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(500).json({ error: "CRON_SECRET no está configurado en el servidor" });
    return false;
  }
  if (req.headers["authorization"] !== `Bearer ${secret}`) {
    res.status(401).json({ error: "No autorizado" });
    return false;
  }
  return true;
};

cronRouter.get("/nightly", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const result = await runNightlyTasks();
    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[cron/nightly] error:", e);
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// Recordatorios por email (turno del día · cuota por vencer · inactividad).
// Agendar 1 vez al día a la mañana en hPanel:
//   curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<tu-api>/cron/reminders
cronRouter.get("/reminders", async (req: Request, res: Response) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const result = await runReminderTasks();
    res.status(200).json({ ok: true, ...result });
  } catch (e: any) {
    console.error("[cron/reminders] error:", e);
    res.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
});

export default cronRouter;
