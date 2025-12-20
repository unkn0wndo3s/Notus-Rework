import { NextResponse } from "next/server";
import { DocumentService } from "@/lib/services/DocumentService";
import { requireAuth, requireDocumentAccess } from "@/lib/security/routeGuards";

const documentService = new DocumentService();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const documentId = parseInt(id);
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

    await documentService.initializeTables();
    const result = await documentService.getDocumentById(documentId);

    if (!result.success || !result.document) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    const doc = result.document;

    // Return title, content, tags, and update date
    const response = {
      success: true,
      title: doc.title,
      content: doc.content,
      tags: doc.tags || [],
      updated_at: doc.updated_at,
      user_id: Number(doc.user_id ?? null),
    };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
