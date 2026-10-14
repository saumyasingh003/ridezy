import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

/*
 * Two ways to deliver email:
 * - Brevo HTTPS API when BREVO_API_KEY is set. Works on hosts that block SMTP
 *   ports (Render's free plan blocks outbound 25/465/587).
 * - SMTP otherwise (local development; a throwaway Ethereal inbox if no SMTP).
 */

let transporterPromise: Promise<Transporter> | undefined;
let usingEthereal = false;

// A blocked or unreachable SMTP server must fail fast, not hang the request.
const SMTP_TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };

async function createTransporter(): Promise<Transporter> {
  const { host, port, user, password } = env.email;

  if (host && port && user && password) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 = implicit TLS; 587 upgrades with STARTTLS
      auth: { user, pass: password },
      ...SMTP_TIMEOUTS,
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

interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** "Ridezy <no-reply@ridezy.app>" → { name: "Ridezy", email: "no-reply@ridezy.app" } */
function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match ? { name: match[1] || undefined, email: match[2]! } : { email: from.trim() };
}

/** Brevo transactional email API (HTTPS, port 443). */
async function sendWithBrevo(apiKey: string, message: OutgoingEmail): Promise<void> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: parseFrom(env.email.from),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brevo responded ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/** Sends one email with whichever transport is configured. Returns a preview URL for Ethereal. */
async function deliver(message: OutgoingEmail): Promise<string | null> {
  if (env.email.brevoApiKey) {
    await sendWithBrevo(env.email.brevoApiKey, message);
    return null;
  }
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: env.email.from, ...message });
  return usingEthereal ? (nodemailer.getTestMessageUrl(info) || null) : null;
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
  const preview = await deliver({ to, ...verificationEmail(name, otp, expiresInMinutes) });
  // Log that an email went out, never its contents (the OTP).
  logger.info(`Verification email sent to ${to}`);
  // Dev-only link to view the caught email in the browser.
  if (preview) logger.info(`Preview email: ${preview}`);
}

export interface PaymentReceiptEmail {
  passengerName: string;
  driverName: string;
  receiptNumber: string;
  /** Final total charged (= breakdown.total). */
  amount: number;
  breakdown: {
    baseFare: number;
    tip: number;
    taxes: number;
    additionalCharges: number;
    discount: number;
    total: number;
  };
  currency: string;
  method: string;
  paidAt: Date;
  pickup: string;
  destination: string;
  vehicleType: string;
  distanceKm: number;
  /** Link to rate the driver; omitted when the passenger has already rated. */
  rateUrl?: string;
}

function money(amount: number, currency: string): string {
  return currency === "INR" ? `₹${amount}` : `${currency} ${amount}`;
}

function paymentReceiptEmail(r: PaymentReceiptEmail) {
  // Names and addresses are user-supplied: escape everything that goes into HTML.
  const e = escapeHtml;
  const paidOn = r.paidAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const total = money(r.amount, r.currency);
  // Fare breakdown: zero lines (no tip, no taxes, ...) are left out.
  const b = r.breakdown;
  const lines: [string, string][] = [
    ["Base ride fare", money(b.baseFare, r.currency)],
    ...(b.tip > 0 ? ([["Driver tip", money(b.tip, r.currency)]] as [string, string][]) : []),
    ...(b.taxes > 0 ? ([["Taxes", money(b.taxes, r.currency)]] as [string, string][]) : []),
    ...(b.additionalCharges > 0 ? ([["Additional charges", money(b.additionalCharges, r.currency)]] as [string, string][]) : []),
    ...(b.discount > 0 ? ([["Discount", `-${money(b.discount, r.currency)}`]] as [string, string][]) : []),
  ];

  const text = [
    "Ridezy - Payment receipt",
    "",
    `Hi ${r.passengerName},`,
    `Thanks for riding with Ridezy. We received ${total} for your trip with ${r.driverName}.`,
    "",
    ...lines.map(([label, value]) => `${label}: ${value}`),
    `Total paid: ${total}`,
    `Method:   ${r.method}`,
    `Paid on:  ${paidOn}`,
    `Pickup:   ${r.pickup}`,
    `Drop:     ${r.destination}`,
    `Trip:     ${r.vehicleType} · ${r.distanceKm} km`,
    `Receipt:  #${r.receiptNumber}`,
    ...(r.rateUrl ? ["", `How was your ride? Rate ${r.driverName}: ${r.rateUrl}`] : []),
    "",
    "Test mode: no real money was charged.",
  ].join("\n");

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#71717a;">${label}</td><td style="padding:6px 0;font-size:14px;font-weight:bold;text-align:right;">${value}</td></tr>`;

  const rateBlock = r.rateUrl
    ? `<tr>
        <td style="padding:0 32px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;">
            <tr>
              <td style="padding:20px;text-align:center;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:bold;">How was your ride with ${e(r.driverName)}?</p>
                <p style="margin:0 0 14px;font-size:13px;color:#71717a;">Your rating and review help other riders and reward great drivers.</p>
                <p style="margin:0 0 14px;font-size:24px;letter-spacing:4px;color:#f59e0b;">★★★★★</p>
                <a href="${e(r.rateUrl)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 22px;border-radius:8px;">Rate &amp; review your ride</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:#18181b;padding:20px 32px;color:#ffffff;font-size:22px;font-weight:bold;">Ridezy <span style="font-size:13px;font-weight:normal;color:#a1a1aa;">Payment receipt</span></td>
      </tr>
      <tr>
        <td style="padding:28px 32px 8px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi ${e(r.passengerName)}, thanks for riding with Ridezy.</p>
          <p style="margin:0;font-size:12px;letter-spacing:2px;color:#71717a;text-align:center;">AMOUNT</p>
          <p style="margin:4px 0 6px;font-size:40px;font-weight:bold;text-align:center;">${e(total)}</p>
          <p style="margin:0 0 20px;text-align:center;"><span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:999px;border:1px solid #a7f3d0;">PAID</span></p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;border-radius:10px;margin-bottom:16px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0;font-size:11px;letter-spacing:1px;color:#71717a;">PICKUP</p>
              <p style="margin:2px 0 10px;font-size:14px;">${e(r.pickup)}</p>
              <p style="margin:0;font-size:11px;letter-spacing:1px;color:#71717a;">DROP</p>
              <p style="margin:2px 0 0;font-size:14px;">${e(r.destination)}</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            ${lines.map(([label, value]) => row(e(label), e(value))).join("")}
            <tr><td style="padding:8px 0 6px;font-size:15px;font-weight:bold;border-top:1px solid #e4e4e7;">Total paid</td><td style="padding:8px 0 6px;font-size:15px;font-weight:bold;text-align:right;border-top:1px solid #e4e4e7;">${e(total)}</td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row("Method", e(r.method))}
            ${row("Driver", e(r.driverName))}
            ${row("Trip", `${e(r.vehicleType)} · ${r.distanceKm} km`)}
            ${row("Paid on", e(paidOn))}
          </table>
          <p style="margin:16px 0 24px;padding-top:12px;border-top:1px dashed #d4d4d8;font-size:12px;color:#71717a;font-family:'Courier New',monospace;">Receipt #${e(r.receiptNumber)}<br />Test mode: no real money was charged.</p>
        </td>
      </tr>
      ${rateBlock}
    </table>
  </body>
</html>`;

  return { subject: `Your Ridezy receipt: ${total} paid`, text, html };
}

async function sendPaymentReceiptEmail(to: string, receipt: PaymentReceiptEmail): Promise<void> {
  const preview = await deliver({ to, ...paymentReceiptEmail(receipt) });
  logger.info(`Payment receipt #${receipt.receiptNumber} emailed to ${to}`);
  if (preview) logger.info(`Preview email: ${preview}`);
}

// Exported as an object so tests can replace methods with a mock.
export const emailService = {
  sendVerificationEmail,
  sendPaymentReceiptEmail,
};
