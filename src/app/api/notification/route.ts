import { NextResponse } from "next/server";
import { NotificationService } from "@/lib/services/NotificationService";
import { requireAuth, requireUserMatch } from "@/lib/security/routeGuards";

export async function GET(request: Request) {
    try {
        const authResult = await requireAuth();
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json(
                { success: false, error: "Access denied" },
                { status: 400 }
            );
        }
        
        const id_receiver = parseInt(id);
        const userMatchCheck = await requireUserMatch(id_receiver, authResult.userId);
        if (userMatchCheck) {
            return userMatchCheck;
        }
        
        const notifSvc = new NotificationService();
        await notifSvc.initializeTables();
        const result = await notifSvc.getNotificationsForUser(id_receiver);
        if (!result.success) {
            return NextResponse.json(
                { success: false, error: "Access denied" },
                { status: 404 }
            );
        }
        return NextResponse.json({ success: true, notifications: result.data ?? [] });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Access denied" },
            { status: 500 }
        );
    }
}