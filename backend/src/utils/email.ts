import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let transporterPromise: Promise<Transporter> | undefined;
let usingEthereal = false;

async function createTransporter(): Promise<Transporter> {
  const { host, port, user, password } = env.email;

  if (host && port && user && password) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades with STARTTLS
      auth: { user, pass: password },
    });
  }

  // Development without SMTP settings: use a throwaway Ethereal inbox.
  // env.ts guarantees this branch can never run in production.
  const account = await nodemailer.createTestAccount();
  usingEthereal = true;
  logger.warn("EMAIL_* not set: using an Ethereal test inbox (development only). Emails are not really delivered.");
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
}

function getTransporter(): Promise<Transporter> {
  transporterPromise ??= createTransporter().catch((err: unknown) => {
    transporterPromise = undefined; // allow a retry on the next send
    throw err;
  });
  return transporterPromise;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function verificationEmail(name: string, otp: string, minutes: number) {
  // The name is user-supplied, so it must be escaped before going into HTML.
  const safeName = escapeHtml(name);

  const text = [
    "Ridezy",
    "Verify your email",
    "",
    `Hi ${name},`,
    "",
    "Your verification code is:",
    "",
    otp,
    "",
    `This code expires in ${minutes} minutes.`,
    "",
    "If you didn't create a Ridezy account, you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#18181b;padding:20px 32px;color:#ffffff;font-size:22px;font-weight:bold;">Ridezy</td>
      </tr>
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:20px;">Verify your email</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${safeName},</p>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Your verification code is:</p>
          <p style="margin:0 0 20px;font-size:34px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</p>
          <p style="margin:0 0 20px;font-size:14px;color:#52525b;">This code expires in ${minutes} minutes.</p>
          <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">If you didn't create a Ridezy account, you can ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: "Verify your Ridezy email", text, html };
}

async function sendVerificationEmail(to: string, name: string, otp: string, expiresInMinutes: number): Promise<void> {
  const transporter = await getTransporter();
  const message = verificationEmail(name, otp, expiresInMinutes);

  const info = await transporter.sendMail({ from: env.email.from, to, ...message });
  // Log that an email went out, never its contents (the OTP).
  logger.info(`Verification email sent to ${to}`);

  if (usingEthereal) {
    // Dev-only link to view the caught email in the browser.
    logger.info(`Preview email: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

// Exported as an object so tests can replace methods with a mock.
export const emailService = {
  sendVerificationEmail,
};
