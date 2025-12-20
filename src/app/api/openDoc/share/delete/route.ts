import { NextResponse } from "next/server";
import { DocumentService } from "@/lib/services/DocumentService";
import { requireAuth, requireDocumentOwnership } from "@/lib/security/routeGuards";

export async function DELETE(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { documentId, email, userId } = body ?? {};

    if (!documentId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }
    if (!email && !userId) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const documentService = new DocumentService();

    const ownershipCheck = await requireDocumentOwnership(documentId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    if (email) {
      const res = await documentService.removeShare(documentId, String(email));
      if (!res.success) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: res.data });
    }

    if (userId) {
      const findRes = await documentService.findShare(documentId, Number(userId));
      if (!findRes.success) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 404 });
      }
      const share = findRes.data?.share;
      const targetEmail = share?.email;
      if (!targetEmail) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
      }
      const delRes = await documentService.removeShare(documentId, String(targetEmail));
      if (!delRes.success) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
      }
      return NextResponse.json({ success: true, data: delRes.data });
    }

    return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
  } catch (e) {
    console.error("❌ Error in /api/openDoc/share/delete DELETE:", e);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}
