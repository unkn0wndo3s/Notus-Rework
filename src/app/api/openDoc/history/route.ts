import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireDocumentAccess } from "@/lib/security/routeGuards";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("documentId") || searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const documentId = parseInt(id, 10);
    if (isNaN(documentId) || documentId <= 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const accessCheck = await requireDocumentAccess(
      documentId,
      authResult.userId,
      authResult.email
    );
    if (accessCheck) {
      return accessCheck;
    }

    const historyEntries = await (prisma as any).documentHistory.findMany({
      where: { document_id: documentId },
      orderBy: { created_at: "asc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            first_name: true,
            last_name: true,
            email: true,
            profile_image: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      history: historyEntries,
    });
  } catch (error) {
    console.error("❌ Error GET /api/openDoc/history:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}


