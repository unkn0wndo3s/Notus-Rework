import { NextResponse } from "next/server";
import { RequestService } from "@/lib/services/RequestService";
import { requireAdmin } from "@/lib/security/routeGuards";

const requestService = new RequestService();

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }

    const { id } = await params;
    await requestService.initializeTables();

    const result = await requestService.rejectRequest(Number.parseInt(id), adminResult.userId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    console.error("❌ Error rejecting request:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

