// api/cron/sendBirthdayEmails.ts
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();
const TIMEZONE = process.env.TIMEZONE || "America/Argentina/Cordoba";


// --- Helpers fecha ---
function getMonthDayFromDate(d: Date, timeZone = TIMEZONE) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        month: "2-digit",
        day: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const month = Number(parts.find((p) => p.type === "month")!.value);
    const day = Number(parts.find((p) => p.type === "day")!.value);
    return { month, day };
}

// --- Helpers email (escape / code) ---
function escapeHtml(s: string) {
    return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function generateShortCode(email: string) {
    // simple deterministic short code; podés reemplazar por random
    const base = Buffer.from(email || "").toString("base64").replace(/=+$/, "");
    return (base + Date.now().toString().slice(-4)).slice(0, 12).toUpperCase();
}

// --- Configurar transporter (asesgúrate variables de entorno) ---
function makeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_PORT) {
        throw new Error("Faltan variables SMTP (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
    }
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465, // true si 465
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

async function sendEmailRaw(to: string, subject: string, html: string) {
    const transporter = makeTransporter();
    await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
    });
}

// --- Email de cumpleaños (HTML) ---
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
        .coupon{display:block;background:linear-gradient(90deg,#fef3c7,#fff7ed);border-radius:8px;padding:14px;margin:12px 0;border:1px dashed #f59e0b}
        .code{font-weight:700;font-size:18px;color:#bb4d00}
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

    await sendEmailRaw(email, subject, html);
}

// --- Handler principal (export default) ---
// --- Handler principal (export default) ---
export default async function handler(req: any, res: any) {
    try {
        // fecha en zona horaria (simplificado: usa directamente new Date() con getMonthDayFromDate)
        const { month: curMonth, day: curDay } = getMonthDayFromDate(new Date(), TIMEZONE);

        // traer usuarios con fechaCumple no nula
        const usuarios = await prisma.user.findMany({
            where: { fechaCumple: { not: null } },
            select: { ID_Usuario: true, email: true, nombre: true, fechaCumple: true },
        });

        const results: Array<{ id: number; email: string; sent: boolean; reason?: string }> = [];

        for (const u of usuarios) {
            try {
                if (!u.fechaCumple) {
                    results.push({ id: u.ID_Usuario, email: u.email!, sent: false, reason: "sin fechaCumple" });
                    continue;
                }

                // Para birthday: usa UTC methods para extraer month/day sin shift (asumiendo DB es local date)
                const fechaCumpleDate = new Date(u.fechaCumple);
                const birthMonth = fechaCumpleDate.getUTCMonth() + 1; // getUTCMonth() es 0-indexed
                const birthDay = fechaCumpleDate.getUTCDate();

                if (!(birthMonth === curMonth && birthDay === curDay)) {
                    continue;
                }

                await sendBirthdayEmail(u.email!, u.nombre ?? "");
                results.push({ id: u.ID_Usuario, email: u.email!, sent: true });
            } catch (errInner: any) {
                console.error("Error enviando mail a usuario", u.ID_Usuario, errInner);
                const reason = errInner?.message ?? String(errInner);
                results.push({ id: u.ID_Usuario, email: u.email!, sent: false, reason });
            }
        }

        const sentCount = results.filter((r) => r.sent).length;
        return res.status(200).json({ message: "Proceso finalizado", sentCount, details: results });
    } catch (err: any) {
        console.error("Error en cron sendBirthdayEmails:", err);
        return res.status(500).json({ error: err?.message ?? String(err) });
    } finally {
        await prisma.$disconnect();
    }
}