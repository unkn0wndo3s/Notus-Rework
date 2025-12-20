import { NextResponse } from "next/server";
import { RequestService } from "@/lib/services/RequestService";
import { UserService } from "@/lib/services/UserService";
import { requireAuth, requireAdmin, requireUserMatch } from "@/lib/security/routeGuards";

const requestService = new RequestService();
const userService = new UserService();

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await requestService.initializeTables();

    const body = await request.json();
    const { type, title, description } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    if (!["help", "data_restoration", "other"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const result = await requestService.createRequest({
      user_id: authResult.userId,
      type: type as "help" | "data_restoration" | "other",
      title: title.trim(),
      description: description.trim(),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, request: result.request }, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating request:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    await requestService.initializeTables();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let result;
    if (userId) {
      const requestedUserId = parseInt(userId);
      const userMatchCheck = await requireUserMatch(requestedUserId, authResult.userId);
      if (userMatchCheck) {
        const adminCheck = await requireAdmin();
        if (adminCheck instanceof NextResponse) {
          return adminCheck;
        }
      }
      result = await requestService.getRequestsByUser(requestedUserId);
    } else {
      const adminCheck = await requireAdmin();
      if (adminCheck instanceof NextResponse) {
        return adminCheck;
      }
      
      const limit = parseInt(searchParams.get("limit") || "100");
      const offset = parseInt(searchParams.get("offset") || "0");
      result = await requestService.getAllRequests(limit, offset);
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, requests: result.requests || [] });
  } catch (error) {
    console.error("❌ Error retrieving requests:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

