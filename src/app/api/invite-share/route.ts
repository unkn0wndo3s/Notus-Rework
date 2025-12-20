import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { EmailService } from "@/lib/services/EmailService";
import { PrismaUserRepository } from "@/lib/repositories/PrismaUserRepository";
import { NotificationService } from "@/lib/services/NotificationService";
import { DocumentService } from "@/lib/services/DocumentService";
import { requireAuth, requireDocumentOwnership } from "@/lib/security/routeGuards";

const secret = process.env.SHARE_INVITE_SECRET || process.env.AUTH_SECRET!;
const documentService = new DocumentService();

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { documentId, email, permission, inviterName, docTitle } = body;

    if (!documentId || !email || !docTitle) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const docId = parseInt(String(documentId));
    if (!Number.isFinite(docId)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const ownershipCheck = await requireDocumentOwnership(docId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    // Normalize the provided email for comparison
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedAuthEmail = authResult.email.toLowerCase().trim();

    // Prevent self-invitation
    if (normalizedEmail === normalizedAuthEmail) {
      return NextResponse.json(
        { success: false, error: "You cannot invite yourself." },
        { status: 400 }
      );
    }

    // Verify if a user with this email exists before sending the email
    const userRepo = new PrismaUserRepository();
    const userResult = await userRepo.getUserByEmail(normalizedEmail);
    if (!userResult.success || !userResult.user) {
      return NextResponse.json(
        { success: false, error: "You cannot send an email to this user." },
        { status: 404 }
      );
    }

    const token = jwt.sign({ id_doc: docId, email: normalizedEmail, permission }, secret, { expiresIn: "2d" });
    const confirmUrl = `${process.env.NEXTAUTH_URL}/api/confirm-share?token=${token}`;

    const emailService = new EmailService();
    const emailResult = await emailService.sendShareInviteEmail(
      normalizedEmail,
      confirmUrl,
      inviterName || "A user",
      docTitle
    );

    if (!emailResult.success) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
    }

    try {
      const notifSvc = new NotificationService();
      const senderId = authResult.userId;

      // message can be structured; NotificationRepository stringifies it
      await notifSvc.sendNotification(senderId, userResult.user.id, {
        type: "share-invite",
        from: inviterName || "A user",
        documentId: docId,
        documentTitle: docTitle,
        url: confirmUrl,
      });
    } catch (e) {
      console.warn("Could not create in-app notification for invite:", e);
    }

    return NextResponse.json({ success: true, message: "Invitation sent!" });
  } catch (error) {
    console.error("❌ API error invite-share:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

