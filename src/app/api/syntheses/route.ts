import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/../lib/auth";
import { DocumentService } from "@/lib/services/DocumentService";

const documentService = new DocumentService();

export async function GET(request: NextRequest) {
  try {
    // Authentication and document access verification are handled by the middleware
    // But we also check explicitly here to guarantee security
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const userEmail = session?.user?.email as string | undefined;

    if (!userId && !userEmail) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 }
      );
    }

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

    // Explicitly verify document access
    const hasAccess = await documentService.userHasAccessToDocument(
      documentId,
      userId,
      userEmail
    );

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const syntheses = await (prisma as any).synthesis.findMany({
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
      syntheses,
    });
  } catch (error) {
    console.error("❌ Error GET /api/syntheses:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication and document access verification are handled by the middleware
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : null;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const { documentId, content } = body as { documentId?: unknown; content?: unknown };

    const parsedDocumentId =
      typeof documentId === "number"
        ? documentId
        : typeof documentId === "string"
        ? parseInt(documentId, 10)
        : NaN;

    if (!parsedDocumentId || isNaN(parsedDocumentId) || parsedDocumentId <= 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const trimmed = content.trim();
    if (trimmed.length > 10000) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const synthesis = await (prisma as any).synthesis.create({
      data: {
        document_id: parsedDocumentId,
        user_id: userId,
        content: trimmed,
      },
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
      synthesis,
    });
  } catch (error) {
    console.error("❌ Error POST /api/syntheses:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

