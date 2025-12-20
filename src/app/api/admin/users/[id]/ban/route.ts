import { NextResponse } from "next/server";
import { UserService } from "@/lib/services/UserService";
import { requireAdmin } from "@/lib/security/routeGuards";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

const userService = new UserService();

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }

    const { id } = await params;
    const { isBanned, reason } = await request.json();

    if (typeof isBanned !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    if (parseInt(id) === adminResult.userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const result = await userService.toggleUserBan(parseInt(id), isBanned, reason);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${isBanned ? "banned" : "unbanned"} successfully`,
      user: result.data,
      emailSent: true,
    });
  } catch (error) {
    console.error("API Error user banning:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
