// api/cron/nightly.ts
// Cron nocturno CONSOLIDADO. En el plan Hobby (gratuito) de Vercel solo se permiten 2 cron jobs,
// por eso unificamos las 3 tareas (cuotas vencidas + turnos ausentes + emails de cumpleaños)
// en un único endpoint con UN solo PrismaClient. Cada tarea va en su propio try/catch para que
// una falla (ej. SMTP) no impida ejecutar las demás.
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const TIMEZONE = process.env.TIMEZONE || "America/Argentina/Cordoba";

function getMonthDayFromDate(d: Date, timeZone = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone, month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(d);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return { month, day };
}

function escapeHtml(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_PORT) {
    throw new Error("Faltan variables SMTP (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendBirthdayEmail(email: string, nombre?: string) {
  const displayName = nombre && nombre.trim().length ? nombre.trim() : "amigo/a";
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const subject = `¡Feliz cumpleaños, ${displayName}! 🎉`;
  const html = `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>¡Feliz cumpleaños!</title>
      <style>
        body,html { margin:0; padding:0; width:100%; background:#f4f6f8; font-family: Arial, sans-serif;}
        .wrap{padding:24px}
        .card{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06)}
        .hero{background:linear-gradient(90deg,#ff9a9e 0%, #fad0c4 50%, #fbc2eb 100%);padding:28px;text-align:center}
        .hero h1{margin:0;font-size:28px;color:#222}
        .content{padding:22px;color:#333}
        .btn{display:inline-block;background:#0ea5a4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600}
        .footer{font-size:12px;color:#9ca3af;text-align:center;padding:14px 18px;border-top:1px solid #f3f4f6}
        @media (max-width:480px){ .hero h1{font-size:22px} .content{padding:16px} }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="hero">
            <h1>¡Feliz cumpleaños, ${escapeHtml(displayName)}! 🎉</h1>
            <p>Hoy es tu día — y queremos celebrarlo contigo.</p>
          </div>
          <div class="content">
            <p>Todo el equipo te desea un día increíble!</p>
            <div style="text-align:center;margin-top:12px">
              <a class="btn" href="${escapeHtml(frontendUrl)}" target="_blank" rel="noopener noreferrer">Ir a mi cuenta</a>
            </div>
            <p style="margin-top:12px;color:#4b5563;font-size:14px">¡Que tengas un muy feliz cumpleaños!</p>
          </div>
          <div class="footer">
            "GymHour" • ${new Date().getFullYear()}
          </div>
        </div>
      </div>
    </body>
  </html>`;
  const transporter = makeTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject,
    html,
  });
}

// 1) Marca como vencidas las cuotas impagas cuyo vencimiento ya pasó.
async function checkVencidas(): Promise<number> {
  const ahora = new Date();
  const { count } = await prisma.cuota.updateMany({
    where: { vence: { lt: ahora }, pagada: false, vencida: false },
    data: { vencida: true },
  });
  return count;
}

// 2) Marca como AUSENTE los turnos ACTIVOS pasados sin asistencia.
async function marcarAusentes(): Promise<number> {
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(23, 59, 59, 999);
  const { count } = await prisma.turno.updateMany({
    where: { estado: "ACTIVO", fecha: { lte: ayer }, Asistencias: { none: {} } },
    data: { estado: "AUSENTE" },
  });
  return count;
}

// 3) Envía emails de cumpleaños del día (best-effort).
async function sendBirthdayEmails(): Promise<number> {
  const { month: curMonth, day: curDay } = getMonthDayFromDate(new Date(), TIMEZONE);
  const usuarios = await prisma.user.findMany({
    where: { fechaCumple: { not: null } },
    select: { ID_Usuario: true, email: true, nombre: true, fechaCumple: true },
  });
  let sent = 0;
  for (const u of usuarios) {
    try {
      if (!u.fechaCumple) continue;
      const f = new Date(u.fechaCumple);
      if (!((f.getUTCMonth() + 1) === curMonth && f.getUTCDate() === curDay)) continue;
      await sendBirthdayEmail(u.email!, u.nombre ?? "");
      sent += 1;
    } catch (e) {
      console.error("nightly: error enviando cumpleaños a usuario", u.ID_Usuario, e);
    }
  }
  return sent;
}

export default async function handler(req: any, res: any) {
  const result: Record<string, unknown> = {};
  try {
    try {
      result.cuotasVencidas = await checkVencidas();
    } catch (e: any) {
      result.cuotasVencidasError = e?.message ?? String(e);
      console.error("nightly: checkVencidas error", e);
    }
    try {
      result.turnosAusentes = await marcarAusentes();
    } catch (e: any) {
      result.turnosAusentesError = e?.message ?? String(e);
      console.error("nightly: marcarAusentes error", e);
    }
    try {
      result.cumpleEnviados = await sendBirthdayEmails();
    } catch (e: any) {
      result.cumpleError = e?.message ?? String(e);
      console.error("nightly: sendBirthdayEmails error", e);
    }
    res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Error en cron nightly:", err);
    res.status(500).json({ ok: false, error: err?.message ?? String(err), ...result });
  } finally {
    await prisma.$disconnect();
  }
}
