import { NextResponse } from "next/server";
import { UserService } from "@/lib/services/UserService";
import { requireAuth } from "@/lib/security/routeGuards";

const userService = new UserService();

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const result = await userService.getUserById(authResult.userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      profileImage: result.user!.profile_image,
    });
  } catch (error) {
    console.error(
      "Error retrieving profile image:",
      error
    );
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}
