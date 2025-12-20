import { NextResponse } from "next/server";
import { DocumentService } from "@/lib/services/DocumentService";
import { requireAuth, requireEmailMatch } from "@/lib/security/routeGuards";

const documentService = new DocumentService();

export async function GET(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const emailCheck = await requireEmailMatch(email, authResult.email);
    if (emailCheck) {
      return emailCheck;
    }

    await documentService.initializeTables();
    const result = await documentService.fetchSharedWithUser(email);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, documents: result.documents ?? [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
