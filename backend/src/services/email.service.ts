import nodemailer from "nodemailer";

// Configuración del transporter usando variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const info = await transporter.sendMail(
    {
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  // Visibilidad en runtime logs: a quién se envió y si el servidor lo aceptó/rechazó.
  console.log('[email] enviado', {
    to,
    subject,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
}
export async function sendWelcomeEmail(email: string, nombre: string): Promise<void> {
  const displayName = escapeHtml(nombre.trim().length ? nombre.trim() : "amigo/a");
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const subject = `¡Bienvenido a GymHour App, ${displayName}! 💪`;

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>¡Bienvenido a GymHourApp!</title>
    <style>
      /* estilos de ayuda, los valores clave se reaplican INLINE */
      a { text-decoration: none; }
      /* evitar que algunos clientes amplíen texto en movil */
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      /* forzar color negro en modo oscuro para iOS */
      @media (prefers-color-scheme: dark) {
        h1, p { color: #000 !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f4f6f8" style="background:#f4f6f8;">
      <tr>
        <td align="center" style="padding:24px;">
          <!-- contenedor -->
          <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; width:100%; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.06);">
            <!-- HERO: uso bgcolor como fallback y background inline (gradiente where supported) -->
            <tr>
              <td align="center" valign="middle"
                  bgcolor="#EAF9FF"
                  style="background: linear-gradient(90deg, #EAF9FF 0%, #57F9FF 60%, #FFFFFF 100%); padding:28px; text-align:center; color:#000000 !important; mso-color-alt:#000000;">
                <!-- encabezado con estilo INLINE y !important -->
                <h1 style="margin:0; font-size:28px; line-height:1.05; font-weight:700; color:#000000 !important; mso-color-alt:#000000; mso-line-height-rule:exactly;">
                  <span style="color:#000000 !important;">¡Bienvenido, ${displayName}! 💪</span>
                </h1>

                <p style="margin:8px 0 0; font-size:16px; color:#000000 !important; mso-color-alt:#000000;">
                  <span style="color:#000000 !important;">Gracias por unirte a GymHour App — tu lugar para entrenar y mejorar cada día.</span>
                </p>
              </td>
            </tr>

            <!-- CONTENT -->
            <tr>
              <td style="padding:22px; color:#111827;">
                <p style="margin:0 0 12px; font-size:15px; line-height:1.5; color:#111827;">
                  Gracias por unirte a <strong>GymHour App</strong>. Aquí podrás reservar clases, rastrear tu progreso, ver rutinas y cuotas.
                </p>

                <p style="margin:0 0 18px; font-size:15px; line-height:1.5; color:#111827;">
                  ¡Esperamos verte pronto en el gimnasio y ayudarte a alcanzar tus metas!
                </p>

                <div style="text-align:center; margin:18px 0;">
                  <!-- Botón con estilos inline, fondo celeste y texto negro -->
                  <a
                    href="${escapeHtml(frontendUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    style="display:inline-block; background:#57F9FF; color:#000000 !important; padding:12px 20px; border-radius:8px; font-weight:700; border:1px solid rgba(0,0,0,0.08); box-shadow:0 6px 18px rgba(87,249,255,0.14);"
                  >
                    Visitar mi cuenta
                  </a>
                </div>

              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="padding:14px 18px; border-top:1px solid #f3f4f6; text-align:center;">
                <span style="font-size:12px; color:#9ca3af;">
                  GymHour App • ${new Date().getFullYear()} • Potenciando tu bienestar.
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  await sendEmail(email, subject, html);
}
// export async function sendResetPasswordEmail(email: string, resetUrl: string): Promise<void> {
//   const html = `
//     <p>Has solicitado reiniciar tu contraseña.</p>
//     <p>Haz clic en el siguiente enlace para establecer una nueva contraseña (expira en 15 minutos):</p>
//     <p><a href="${resetUrl}">${resetUrl}</a></p>
//     <p>Si no solicitaste este cambio, ignora este correo.</p>
//   `;
//   await sendEmail(email, "Reset de Contraseña", html);
// }

export async function sendResetPasswordEmail(email: string, resetUrl: string): Promise<void> {
  const subject = "Reset de Contraseña";

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Restablece tu Contraseña</title>
    <style>
      body,html { margin:0; padding:0; width:100%; background:#f4f6f8; font-family: Arial, sans-serif;}
      .wrap{padding:24px}
      .card{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.06)}
      .hero{background:linear-gradient(90deg,#ef4444 0%, #991b1b 50%, #000000 100%);padding:28px;text-align:center}
      .hero h1{margin:0;font-size:28px;color:#fff}
      .hero p{margin:8px 0 0;color:#fee2e2;font-size:16px}
      .content{padding:22px;color:#333}
      .content p{margin:0 0 16px;font-size:15px;line-height:1.5}
      .btn{display:inline-block;background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600}
      .footer{font-size:12px;color:#9ca3af;text-align:center;padding:14px 18px;border-top:1px solid #f3f4f6}
      @media (max-width:480px){ .hero h1{font-size:22px} .hero p{font-size:14px} .content{padding:16px} }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="hero">
          <h1>Restablece tu Contraseña 🔑</h1>
          <p>Has solicitado un cambio de contraseña en GymHour App.</p>
        </div>
        <div class="content">
          <p>Haz clic en el botón a continuación para establecer una nueva contraseña. Este enlace expira en 15 minutos por razones de seguridad.</p>
          <div style="text-align:center;margin:20px 0">
            <a class="btn" href="${resetUrl}" target="_blank" rel="noopener noreferrer">Restablecer Contraseña</a>
          </div>
          <p>Si no solicitaste este cambio, ignora este correo o contacta a soporte si crees que es un error.</p>
          <p style="color:#4b5563;font-size:14px;text-align:center">Mantén tu cuenta segura.</p>
        </div>
        <div class="footer">
          GymHour App • ${new Date().getFullYear()} • Protegiendo tu acceso.
        </div>
      </div>
    </div>
  </body>
</html>`;

  await sendEmail(email, subject, html);
}

export async function sendBirthdayEmail(email: string, nombre?: string): Promise<void> {
  const displayName = nombre ? nombre : "amigo/a de GymApp";
  const frontendUrl = process.env.FRONTEND_URL ?? "#";

  const subject = `¡Feliz cumpleaños, ${displayName}! 🎉`;

  const html = `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>¡Feliz cumpleaños!</title>
      <style>
        /* Reset básico */
        body,html { margin:0; padding:0; width:100%; background:#f4f6f8; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
        table { border-collapse:collapse; }
        img { border:0; display:block; line-height:100%; outline:none; text-decoration:none; max-width:100%; height:auto; }

        /* Contenedor */
        .email-wrap { width:100%; padding:24px 12px; background: linear-gradient(180deg,#f7f8fb 0%, #f4f6f8 100%); font-family: 'Helvetica Neue', Arial, sans-serif; }

        .card {
          max-width:640px;
          margin:0 auto;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 8px 30px rgba(31,41,55,0.06);
          overflow:hidden;
        }

        .hero {
          background: linear-gradient(90deg, #ff9a9e 0%, #fad0c4 50%, #fbc2eb 100%);
          padding: 28px 24px;
          text-align: center;
        }
        .hero h1 {
          margin:0;
          font-size: 28px;
          color: #2b2b2b;
        }
        .hero p {
          margin:8px 0 0 0;
          font-size:14px;
          color: #222;
          opacity:0.95;
        }

        .content {
          padding: 22px 24px;
          color:#333333;
          line-height:1.45;
        }

        .greeting {
          font-size:18px;
          margin:0 0 12px 0;
          color:#111827;
        }

        .text {
          font-size:14px;
          margin:0 0 18px 0;
          color:#4b5563;
        }

        .coupon {
          display:block;
          background: linear-gradient(90deg,#fef3c7,#fff7ed);
          border-radius:8px;
          padding:14px;
          margin: 12px 0 18px 0;
          border:1px dashed #f59e0b;
        }
        .coupon .code {
          font-weight:700;
          font-size:18px;
          letter-spacing:1px;
          color:#bb4d00;
        }
        .coupon .small {
          font-size:12px;
          color:#6b7280;
          margin-top:6px;
        }

        .cta {
          text-align:center;
          margin: 10px 0 18px 0;
        }
        .btn {
          display:inline-block;
          background:#0ea5a4;
          color:#fff;
          padding:12px 20px;
          border-radius:8px;
          text-decoration:none;
          font-weight:600;
          font-size:14px;
        }

        .footer {
          font-size:12px;
          color:#9ca3af;
          text-align:center;
          padding:14px 18px;
          border-top:1px solid #f3f4f6;
        }

        /* responsive */
        @media (max-width:480px) {
          .hero h1 { font-size:22px; }
          .content { padding:16px; }
        }
      </style>
    </head>
    <body>
      <div class="email-wrap" role="article" aria-roledescription="email" aria-label="Feliz cumpleaños">
        <div class="card" role="presentation">

          <!-- HERO -->
          <div class="hero" role="presentation">
            <!-- Puedes reemplazar por una imagen si querés -->
            <h1>¡Feliz cumpleaños, ${escapeHtml(displayName)}! 🎉</h1>
            <p>Hoy es tu día — y queremos celebrarlo contigo</p>
          </div>

          <!-- CONTENT -->
          <div class="content">
            <p class="greeting">Hola ${escapeHtml(displayName)},</p>

            <p class="text">
              Todo el equipo de <strong>GymApp</strong> te desea un día increíble. Gracias por ser parte de nuestra comunidad:
              te preparamos un regalo especial para que disfrutes en tu próximo ingreso al gimnasio.
            </p>

            <div class="coupon" role="group" aria-label="Cupón de cumpleaños">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                <div>
                  <div style="font-size:13px;color:#92400e;font-weight:700;">Regalo de cumpleaños</div>
                  <div class="small">Canjealo en tu próxima reserva o presenta en recepción</div>
                </div>
                <div style="text-align:right">
                  <div class="code">CUMPLE-${generateShortCode(email)}</div>
                  <div class="small">Válido 30 días</div>
                </div>
              </div>
            </div>

            <div style="margin-bottom:6px;" class="text">
              <strong>¿Querés aprovechar ahora?</strong> Reserva una clase o revisa nuestras promociones haciendo clic abajo.
            </div>

            <div class="cta">
              <a class="btn" href="${frontendUrl}" target="_blank" rel="noopener noreferrer">Ir a mi cuenta</a>
            </div>

            <p class="text" style="margin-top:6px;">
              ¡Que tengas un muy feliz cumpleaños! Si querés, respondé este mail y te ayudamos a coordinar tu visita.
            </p>
          </div>

          <div class="footer">
            GymApp • ${new Date().getFullYear()} • Si no querés recibir este tipo de correos, ingresá a tu perfil y desactivá notificaciones.
          </div>

        </div>
      </div>
    </body>
  </html>
  `;

  // sendEmail debe ser tu función existente que envía el mail (ya la usabas antes)
  await sendEmail(email, subject, html);
}

// ───────────────────────────────────────────────────────────────────────────
// Recordatorios (crons): turno del día · cuota por vencer · inactividad
// ───────────────────────────────────────────────────────────────────────────

const money = (v: number): string => `$${Number(v || 0).toLocaleString("es-AR")}`;

const emailShell = (heroBg: string, heroTitle: string, heroSubtitle: string, bodyHtml: string): string => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="color-scheme" content="light" />
    <style>
      body,html { margin:0; padding:0; width:100%; background:#f4f6f8; font-family: Arial, Helvetica, sans-serif; }
      a { text-decoration:none; }
      .wrap { padding:24px 12px; }
      .card { max-width:640px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.06); }
      .hero { padding:28px 24px; text-align:center; }
      .hero h1 { margin:0; font-size:26px; color:#ffffff; }
      .hero p { margin:8px 0 0; font-size:15px; color:#ffffff; opacity:.95; }
      .content { padding:22px 24px; color:#333; line-height:1.5; }
      .content p { margin:0 0 14px; font-size:15px; }
      .btn { display:inline-block; background:#DA4632; color:#ffffff !important; padding:12px 22px; border-radius:8px; font-weight:700; }
      .cta { text-align:center; margin:18px 0 6px; }
      .footer { font-size:12px; color:#9ca3af; text-align:center; padding:14px 18px; border-top:1px solid #f3f4f6; }
      @media (max-width:480px){ .hero h1{ font-size:22px } .content{ padding:16px } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="hero" style="background:${heroBg};">
          <h1>${heroTitle}</h1>
          <p>${heroSubtitle}</p>
        </div>
        <div class="content">
          ${bodyHtml}
        </div>
        <div class="footer">GymHour App • ${new Date().getFullYear()}</div>
      </div>
    </div>
  </body>
</html>`;

/** Recordatorio: el alumno tiene turno(s) hoy. */
export async function sendTurnoReminderEmail(
  email: string,
  nombre: string,
  turnos: Array<{ clase: string; horario: string }>
): Promise<void> {
  const displayName = escapeHtml(nombre?.trim() || "crack");
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const subject = "📅 Recordatorio: hoy tenés turno en el gimnasio";

  const items = turnos
    .map(
      (t) => `<tr>
        <td style="padding:10px 12px; border:1px solid #eee; font-weight:700; color:#111;">${escapeHtml(t.clase)}</td>
        <td style="padding:10px 12px; border:1px solid #eee; color:#444;">${escapeHtml(t.horario)} hs</td>
      </tr>`
    )
    .join("");

  const body = `
    <p>¡Hola ${displayName}! 💪</p>
    <p>Te recordamos que <strong>hoy tenés turno</strong>. Acá están los detalles:</p>
    <table style="border-collapse:collapse; width:100%; margin:6px 0 14px;">
      <thead>
        <tr>
          <th style="text-align:left; padding:10px 12px; background:#fafafa; border:1px solid #eee; font-size:13px; color:#666;">Clase</th>
          <th style="text-align:left; padding:10px 12px; background:#fafafa; border:1px solid #eee; font-size:13px; color:#666;">Horario</th>
        </tr>
      </thead>
      <tbody>${items}</tbody>
    </table>
    <p>Dale que vos podés: cada entrenamiento te acerca a tu objetivo. 🔥</p>
    <p><strong>¡Te esperamos!</strong></p>
    <div class="cta"><a class="btn" href="${escapeHtml(frontendUrl)}" target="_blank" rel="noopener noreferrer">Ver mis turnos</a></div>
  `;

  await sendEmail(email, subject, emailShell("linear-gradient(90deg,#DA4632 0%, #ee6a52 100%)", "Hoy entrenás 💪", "Tu turno te está esperando", body));
}

/** Recordatorio: a la cuota le faltan ~3 días para vencer. */
export async function sendCuotaPorVencerEmail(
  email: string,
  nombre: string,
  data: { vence: Date; importe: number; mes: string; diasRestantes: number }
): Promise<void> {
  const displayName = escapeHtml(nombre?.trim() || "crack");
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const venceStr = `${String(data.vence.getUTCDate()).padStart(2, "0")}/${String(data.vence.getUTCMonth() + 1).padStart(2, "0")}/${data.vence.getUTCFullYear()}`;
  const dias = data.diasRestantes;
  const subject = `⏰ Tu cuota vence en ${dias} día${dias === 1 ? "" : "s"}`;

  const body = `
    <p>¡Hola ${displayName}!</p>
    <p>Te avisamos que tu cuota <strong>vence el ${venceStr}</strong> (en ${dias} día${dias === 1 ? "" : "s"}).</p>
    <p style="margin:0 0 6px;">Detalle:</p>
    <ul style="margin:0 0 14px; padding-left:18px; color:#444;">
      <li>Período: <strong>${escapeHtml(data.mes)}</strong></li>
      <li>Importe: <strong>${money(data.importe)}</strong></li>
    </ul>
    <p>Renová a tiempo y seguí entrenando sin interrupciones. 💪</p>
    <div class="cta"><a class="btn" href="${escapeHtml(frontendUrl)}" target="_blank" rel="noopener noreferrer">Ver mi cuota</a></div>
  `;

  await sendEmail(email, subject, emailShell("linear-gradient(90deg,#f59e0b 0%, #f97316 100%)", "Tu cuota está por vencer ⏰", `Vence el ${venceStr}`, body));
}

/** Recordatorio: el alumno hace ~15 días que no asiste. */
export async function sendInactividadEmail(email: string, nombre: string, dias: number): Promise<void> {
  const displayName = escapeHtml(nombre?.trim() || "crack");
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const subject = "💜 Te extrañamos en el gimnasio";

  const body = `
    <p>¡Hola ${displayName}!</p>
    <p>Hace ${dias} días que no te vemos por el gimnasio y <strong>te extrañamos</strong>. 💜</p>
    <p>Sabemos que arrancar de nuevo cuesta, pero el primer paso es el más importante: reservá tu próximo turno y volvé a tu rutina. ¡Tu mejor versión te está esperando!</p>
    <p><strong>¿Volvemos a entrenar?</strong> 🔥</p>
    <div class="cta"><a class="btn" href="${escapeHtml(frontendUrl)}" target="_blank" rel="noopener noreferrer">Reservar un turno</a></div>
  `;

  await sendEmail(email, subject, emailShell("linear-gradient(90deg,#7928ca 0%, #a855f7 100%)", "¡Te extrañamos! 💜", "Volvé a entrenar con todo", body));
}

/** Mail de retención enviado manualmente por el admin desde "Riesgo de baja".
 *  El admin escribe texto plano; acá se escapa y se inyecta en la plantilla de marca. */
export async function sendRetencionEmail(
  email: string,
  data: { nombre: string; asunto: string; mensaje: string }
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL ?? "#";
  const displayName = escapeHtml(data.nombre?.trim() || "");

  // Texto plano → párrafos HTML escapados (los saltos de línea se respetan)
  const parrafos = String(data.mensaje)
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const body = `
    ${parrafos}
    <div class="cta"><a class="btn" href="${escapeHtml(frontendUrl)}" target="_blank" rel="noopener noreferrer">Reservar un turno</a></div>
  `;

  await sendEmail(
    email,
    data.asunto,
    emailShell(
      "linear-gradient(90deg,#DA4632 0%, #ee6a52 100%)",
      escapeHtml(data.asunto),
      displayName ? `Para ${displayName}` : "Tenemos un mensaje para vos",
      body
    )
  );
}

/**
 * Helpers:
 * - escapeHtml: evita inyección de caracteres en el template
 * - generateShortCode: genera un código legible basado en email (no criptográfico)
 */
function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateShortCode(input: string | undefined): string {
  const s = (input ?? Math.random().toString(36).slice(2, 10)).toUpperCase();
  // toma 6 caracteres alfanum (limpiando símbolos)
  return s.replace(/[^A-Z0-9]/g, '').slice(0, 6);
}
