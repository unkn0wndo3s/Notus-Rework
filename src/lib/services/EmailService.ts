import crypto from "crypto";
import { Resend } from "resend";
import { EmailResult } from "../types";

// Resend Configuration - only initialize if API key is present
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export class EmailService {
  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async sendVerificationEmail(email: string, token: string, firstName: string): Promise<EmailResult> {
    const verificationUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    // If no Resend API key, simulate sending
    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Verify your Notus account",
        html: this.getVerificationEmailTemplate(verificationUrl, firstName),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<EmailResult> {
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    // If no Resend API key, simulate sending
    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-welcome-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Welcome to Notus - Your account is activated!",
        html: this.getWelcomeEmailTemplate(firstName),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending welcome email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendPasswordResetEmail(email: string, token: string, firstName: string): Promise<EmailResult> {
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    // If no Resend API key, simulate sending
    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-reset-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Notus Password Reset",
        html: this.getPasswordResetEmailTemplate(resetUrl, firstName),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending reset email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendBanNotificationEmail(email: string, firstName: string, reason: string | null = null): Promise<EmailResult> {
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    // If no Resend API key, simulate sending
    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-ban-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Your Notus account has been suspended",
        html: this.getBanNotificationEmailTemplate(firstName, reason),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending ban email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendUnbanNotificationEmail(email: string, firstName: string): Promise<EmailResult> {
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    // If no Resend API key, simulate sending
    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-unban-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Your Notus account has been reactivated",
        html: this.getUnbanNotificationEmailTemplate(firstName),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending unban email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async sendShareInviteEmail(
    email: string,
    link: string,
    inviterName: string,
    docTitle: string
  ): Promise<EmailResult> {
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

        // Debug: log environment and parameters
    console.log("[EmailService] RESEND_API_KEY:", process.env.RESEND_API_KEY ? "set" : "NOT SET");
    console.log("[EmailService] EMAIL_FROM:", process.env.EMAIL_FROM);
    console.log("[EmailService] To:", email);
    console.log("[EmailService] Subject:", `${inviterName} invited you to collaborate on "${docTitle}"`);
    console.log("[EmailService] Link:", link);

    // Simulate if no Resend API key
    if (!process.env.RESEND_API_KEY || !resend) {
      console.warn("[EmailService] Simulation mode: email not actually sent.");
      return { success: true, messageId: `sim-share-invite-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: `${inviterName} invited you to collaborate on "${docTitle}"`,
        html: this.getShareInviteEmailTemplate(link, inviterName, docTitle),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      console.log("[EmailService] Email sent successfully. Message ID:", data.id);
      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending share invite email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }


  async sendDeletionCompletedEmail(email: string, firstName: string): Promise<EmailResult> {
    const from = process.env.EMAIL_FROM || "Notus <noreply@notus.com>";

    if (!process.env.RESEND_API_KEY || !resend) {
      return { success: true, messageId: `sim-delete-completed-${Date.now()}` };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: from,
        to: [email],
        subject: "Your Notus account has been deleted",
        html: this.getDeletionCompletedEmailTemplate(firstName),
      });

      if (error) {
        console.error("❌ Resend Error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data.id };
    } catch (error: unknown) {
      console.error("❌ Error sending deletion confirmation email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  private getVerificationEmailTemplate(verificationUrl: string, firstName: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
            <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">Welcome to Notus</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello ${firstName} 👋</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Thanks for signing up. Please verify your email address to activate your account.</p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${verificationUrl}" style="background:#A855F7; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:16px;">Verify my email</a>
            </div>
            <p style="margin:0; color:#94a3b8; font-size:13px;">If the button doesn't work:</p>
            <p style="margin:6px 0 0; color:#94a3b8; font-size:13px; word-break:break-all;"><a href="${verificationUrl}" style="color:#A855F7;">${verificationUrl}</a></p>
            <p style="margin:16px 0 0; color:#94a3b8; font-size:13px;">Link valid for 24 hours.</p>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }

  private getWelcomeEmailTemplate(firstName: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">🎉 Account Activated</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Welcome ${firstName}!</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Your Notus account is ready. Get started now.</p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${process.env.NEXTAUTH_URL}/login" style="background:#A855F7; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:16px;">Login</a>
            </div>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }

  private getPasswordResetEmailTemplate(resetUrl: string, firstName: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">🔐 Password Reset</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello ${firstName}</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Click the button below to create a new password.</p>
            <div style="text-align:center; margin:28px 0;">
              <a href="${resetUrl}" style="background:#A855F7; color:#ffffff; padding:14px 24px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:16px;">Reset my password</a>
            </div>
            <p style="margin:0; color:#94a3b8; font-size:13px;">If the button doesn't work:</p>
            <p style="margin:6px 0 0; color:#94a3b8; font-size:13px; word-break:break-all;"><a href="${resetUrl}" style="color:#A855F7;">${resetUrl}</a></p>
            <p style="margin:16px 0 0; color:#94a3b8; font-size:13px;">Link valid for 24 hours.</p>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }

  private getBanNotificationEmailTemplate(firstName: string, reason: string | null): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">⚠️ Account Suspended</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello ${firstName}</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Your Notus account has been suspended by our team.</p>
            ${reason ? `
            <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px; margin:20px 0;">
              <h3 style="margin:0 0 8px; font-size:16px; color:#9a3412; font-family:'Roboto Condensed', Arial, sans-serif;">Reason:</h3>
              <p style="margin:0; color:#9a3412;">${reason}</p>
            </div>
            ` : ""}
            <div style="background:#f8fafc; border-radius:12px; padding:16px; margin:20px 0;">
              <h3 style="margin:0 0 10px; font-size:16px; color:#0f172a; font-family:'Roboto Condensed', Arial, sans-serif;">What to do?</h3>
              <ul style="margin:0; padding-left:20px; color:#475569; line-height:1.65;">
                <li>If you think this is a mistake, contact support</li>
                <li>Respect the terms of service</li>
              </ul>
            </div>
            <div style="text-align:center; margin:24px 0;">
              <a href="mailto:${process.env.ADMIN_EMAIL || "admin@notus.com"}" style="background:#0f172a; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:15px;">Contact support</a>
            </div>
            <p style="margin:0; color:#94a3b8; font-size:13px;">This is an automated email, please do not reply.</p>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }

  private getUnbanNotificationEmailTemplate(firstName: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">🎉 Account Reactivated</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello ${firstName}</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Your Notus account is active again.</p>
            <div style="text-align:center; margin:24px 0;">
              <a href="${process.env.NEXTAUTH_URL}/login" style="background:#A855F7; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:15px;">Login</a>
            </div>
            <div style="background:#f8fafc; border-radius:12px; padding:16px; margin:20px 0;">
              <h3 style="margin:0 0 10px; font-size:16px; color:#0f172a; font-family:'Roboto Condensed', Arial, sans-serif;">Tips</h3>
              <ul style="margin:0; padding-left:20px; color:#475569; line-height:1.65;">
                <li>Respect the terms of service</li>
                <li>Contact support if you have questions</li>
              </ul>
            </div>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }

  private getShareInviteEmailTemplate(link: string, inviterName: string, docTitle: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:26px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">Collaboration Invite</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello!</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">${inviterName} invited you to collaborate on "${docTitle}".</p>
            <div style="text-align:center; margin:24px 0;">
              <a href="${link}" style="background:#A855F7; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:12px; font-weight:700; display:inline-block; font-size:15px;">Accept invitation</a>
            </div>
            <p style="margin:0; color:#94a3b8; font-size:13px;">Or copy-paste this link:</p>
            <p style="margin:6px 0 0; color:#94a3b8; font-size:13px; word-break:break-all;"><a href="${link}" style="color:#A855F7;">${link}</a></p>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }


  private getDeletionCompletedEmailTemplate(firstName: string): string {
    return `
      <div style="background:#F7F8FA; padding:24px; font-family: Nunito, Arial, sans-serif; color:#0f172a;">
        <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
          <div style="background:linear-gradient(135deg,#A855F7 0%,#EC4899 100%); padding:28px; text-align:center;">
            <h1 style="margin:0; font-size:24px; line-height:1.2; color:#ffffff; font-family:'Roboto Condensed', Arial, sans-serif;">Account Deleted</h1>
          </div>
          <div style="padding:28px;">
            <h2 style="margin:0 0 12px; font-size:20px; font-family:'Roboto Condensed', Arial, sans-serif;">Hello ${firstName}</h2>
            <p style="margin:0 0 16px; color:#475569; line-height:1.65;">Your account has been deleted. You can still reactivate it within 30 days by logging in with the same email address.</p>
            <p style="margin:0; color:#94a3b8; font-size:13px;">If you didn't request this, contact support immediately.</p>
          </div>
          <div style="background:#0f172a; color:#ffffff; text-align:center; padding:16px; font-size:12px;">© 2025 Notus</div>
        </div>
      </div>`;
  }
}
