import { NextResponse } from "next/server";
import { UserService } from "../../../lib/services/UserService";

const userService = new UserService();

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const result = await userService.verifyUserEmail(token);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Welcome ${result.data!.first_name}! Your account has been successfully activated.`,
    });
  } catch (error) {
    console.error("❌ API Error email verification:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
