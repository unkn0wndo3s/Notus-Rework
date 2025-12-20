import { NextResponse } from "next/server";
import { DocumentService } from "@/lib/services/DocumentService";
import { requireAuth, requireDocumentOwnership } from "@/lib/security/routeGuards";

const documentService = new DocumentService();

export async function PATCH(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { documentId, email, userId, permission } = body ?? {};

    if (!documentId || (typeof permission !== "boolean")) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    if (!email && !userId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const ownershipCheck = await requireDocumentOwnership(documentId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    if (email) {
      const res = await documentService.addShare(documentId, email, permission);
      if (!res.success) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (userId) {
      const res = await documentService.updatePermission(documentId, Number(userId), permission);
      if (!res.success) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: res.data });
    }

    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  } catch (e) {
    console.error("❌ Error in /api/openDoc/share PATCH:", e);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}
