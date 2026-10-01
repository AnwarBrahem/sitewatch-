import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface AlertEmailPayload {
  siteName: string;
  sensorType: string;
  sensorUnit: string;
  sensorId: number;
  value: number;
  threshold: number;
  triggeredAt: Date;
}

// Create reusable transporter
function createTransporter() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
    }

    // Default to Gmail if SMTP_HOST not explicitly provided
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return null;
}

const transporter = createTransporter();

export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const recipient = process.env.ALERT_EMAIL_TO || process.env.GMAIL_USER || 'operations@sitewatch-demo.local';
  const sender = process.env.SMTP_USER || process.env.GMAIL_USER || 'alerts@sitewatch.io';

  const subject = `🚨 CRITICAL ALERT: ${payload.sensorType.toUpperCase()} breached at ${payload.siteName}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #ef4444;">
      <div style="background: linear-gradient(135deg, #ef4444, #b91c1c); padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff;">⚠️ STRUCTURAL ANOMALY DETECTED</h1>
        <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9; color: #fee2e2;">SiteWatch Automated Sensor Telemetry Guard</p>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; line-height: 1.5; margin-top: 0;">
          A structural telemetry reading has exceeded safety threshold limits on infrastructure asset <strong>${payload.siteName}</strong>.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #1e293b; border-radius: 8px;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 12px 16px; color: #94a3b8; font-size: 14px;">Site Name</td>
            <td style="padding: 12px 16px; font-weight: 600; font-size: 14px; color: #f8fafc;">${payload.siteName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 12px 16px; color: #94a3b8; font-size: 14px;">Sensor ID & Type</td>
            <td style="padding: 12px 16px; font-weight: 600; font-size: 14px; color: #38bdf8;">#${payload.sensorId} (${payload.sensorType})</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 12px 16px; color: #94a3b8; font-size: 14px;">Recorded Value</td>
            <td style="padding: 12px 16px; font-weight: 700; font-size: 16px; color: #ef4444;">${payload.value} ${payload.sensorUnit}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 12px 16px; color: #94a3b8; font-size: 14px;">Safety Threshold</td>
            <td style="padding: 12px 16px; font-weight: 600; font-size: 14px; color: #fbbf24;">${payload.threshold} ${payload.sensorUnit}</td>
          </tr>
          <tr>
            <td style="padding: 12px 16px; color: #94a3b8; font-size: 14px;">Timestamp</td>
            <td style="padding: 12px 16px; font-size: 14px; color: #cbd5e1;">${new Date(payload.triggeredAt).toUTCString()}</td>
          </tr>
        </table>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.4;">
          Immediate inspection protocol is recommended. Please review the live GIS dashboard for spatial telemetry correlations.
        </p>
      </div>
      <div style="background: #020617; padding: 14px 24px; text-align: center; font-size: 12px; color: #64748b;">
        SiteWatch Simulated IoT Platform • Express + TypeScript + PostgreSQL
      </div>
    </div>
  `;

  if (!transporter) {
    console.log(
      `\x1b[33m📧 [SIMULATED EMAIL DISPATCH]\x1b[0m To: ${recipient} | Subject: "${subject}" | Value: ${payload.value} ${payload.sensorUnit} (Threshold: ${payload.threshold})`
    );
    console.log(`   💡 Note: Configure GMAIL_USER & GMAIL_APP_PASSWORD in backend/.env to send real live emails via SMTP.`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"SiteWatch Monitoring" <${sender}>`,
      to: recipient,
      subject,
      html,
    });
    console.log(`\x1b[32m✔ [EMAIL DISPATCHED]\x1b[0m Alert email sent successfully to ${recipient} (Message ID: ${info.messageId})`);
  } catch (error: any) {
    console.error(`\x1b[31m✖ [EMAIL ERROR]\x1b[0m Failed to send email via SMTP:`, error.message);
  }
}
