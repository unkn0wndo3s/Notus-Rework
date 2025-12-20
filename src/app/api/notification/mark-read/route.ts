import { NextResponse } from "next/server";
import { NotificationService } from "@/lib/services/NotificationService";
import { requireAuth, requireNotificationOwnership } from "@/lib/security/routeGuards";

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const notificationId = body?.notificationId;
    if (!notificationId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const ownershipCheck = await requireNotificationOwnership(
      Number(notificationId),
      authResult.userId
    );
    if (ownershipCheck) {
      return ownershipCheck;
    }

    const notifSvc = new NotificationService();
    const result = await notifSvc.markNotificationAsRead(Number(notificationId));
    if (!result.success) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}
