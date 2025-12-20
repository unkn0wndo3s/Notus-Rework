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

    // Check document access (owner or shared user)
    const accessCheck = await requireDocumentAccess(
      documentId,
      authResult.userId,
      authResult.email
    );
    if (accessCheck) {
      return accessCheck;
    }

    const result = await documentService.fetchDocumentAccessList(documentId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, accessList: result.data?.accessList ?? [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
