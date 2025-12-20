import { NextResponse } from "next/server";
import { NotificationService } from "@/lib/services/NotificationService";
import { requireAuth, requireNotificationOwnership } from "@/lib/security/routeGuards";

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    let idParam = searchParams.get("id");

    if (!idParam) {
      try {
        const body = await request.json();
        idParam = body?.id ?? body?.notificationId ?? body?.notification_id;
      } catch {
      }
    }

    if (!idParam) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const notificationId = Number.parseInt(String(idParam), 10);
    if (Number.isNaN(notificationId)) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const ownershipCheck = await requireNotificationOwnership(notificationId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    const notifSvc = new NotificationService();
    const result = await notifSvc.deleteNotification(notificationId);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 200 });
  } catch (error) {
    console.error("API /notification/delete DELETE error:", error);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}