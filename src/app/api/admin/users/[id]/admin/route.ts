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
    const { isAdmin: newAdminStatus } = await request.json();

    if (typeof newAdminStatus !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const targetUserId = parseInt(id);
    if (isNaN(targetUserId) || targetUserId <= 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    if (targetUserId === adminResult.userId && !newAdminStatus) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const result = await userService.toggleUserAdmin(targetUserId, newAdminStatus);

    if (!result.success) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${
        newAdminStatus ? "promoted to administrator" : "demoted"
      } successfully`,
      user: result.data,
    });
  } catch (error) {
    console.error("API Error admin status change:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
