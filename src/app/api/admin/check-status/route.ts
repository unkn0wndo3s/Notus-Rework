import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { UserService } from "@/lib/services/UserService";

const userService = new UserService();

export async function GET() {
  try {
    // 1) Verify database connectivity (simple ping)
    const ping = await userService.getAllUsers(1, 0);
    if (!ping.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 503 }
      );
    }

    // 2) If DB OK, try to retrieve session and return admin status (optional)
    const session = await auth();
    const isAdmin = session?.user?.id
      ? await userService.isUserAdmin(Number.parseInt(session.user.id))
      : false;

    return NextResponse.json({ success: true, reachable: true, isAdmin }, { status: 200 });
  } catch (error) {
    // Global error (e.g., server/edge unavailable) => 503
    console.error("Error checking admin status:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 503 }
    );
  }
}
