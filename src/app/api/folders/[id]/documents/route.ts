import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireFolderOwnership } from "@/lib/security/routeGuards";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const folderId = Number.parseInt(id);

    if (Number.isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const ownershipCheck = await requireFolderOwnership(folderId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    const body = await request.json();
    const { documentIds } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const documentIdsNumbers = documentIds.map((id) => Number.parseInt(String(id))).filter((id) => !Number.isNaN(id));
    
    // Check if documents belong to user
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIdsNumbers },
        user_id: authResult.userId,
      },
    });

    if (documents.length !== documentIdsNumbers.length) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Add documents to folder (legacy table name or map)
    const existingLinks = await prisma.folderDocument.findMany({
      where: {
        folder_id: folderId,
        document_id: { in: documentIdsNumbers },
      },
    });

    const existingDocumentIds = new Set(existingLinks.map((link) => link.document_id));
    const newDocumentIds = documentIdsNumbers.filter((id) => !existingDocumentIds.has(id));

    if (newDocumentIds.length > 0) {
      await prisma.folderDocument.createMany({
        data: newDocumentIds.map((docId) => ({
          folder_id: folderId,
          document_id: docId,
        })),
      });
    }

    return NextResponse.json({ success: true, added: newDocumentIds.length });
  } catch (error) {
    console.error("❌ Error adding documents to folder:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const folderId = Number.parseInt(id);

    if (Number.isNaN(folderId)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const ownershipCheck = await requireFolderOwnership(folderId, authResult.userId);
    if (ownershipCheck) {
      return ownershipCheck;
    }

    const body = await request.json();
    const { documentIds } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const documentIdsNumbers = documentIds.map((id) => Number.parseInt(String(id))).filter((id) => !Number.isNaN(id));

    // Remove documents from folder
    await prisma.folderDocument.deleteMany({
      where: {
        folder_id: folderId,
        document_id: { in: documentIdsNumbers },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error removing documents from folder:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
