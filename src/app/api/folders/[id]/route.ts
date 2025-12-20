import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireFolderOwnership } from "@/lib/security/routeGuards";

export async function GET(
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

    // Using prisma.folder
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, user_id: authResult.userId },
      include: {
        documents: {
          include: {
            document: true,
          },
          orderBy: {
            created_at: "desc",
          },
        },
      },
    });

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      folder: {
        id: folder.id,
        name: folder.name,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
        documents: folder.documents.map((dd) => ({
          id: dd.document.id,
          title: dd.document.title,
          content: dd.document.content,
          tags: dd.document.tags,
          is_favorite: dd.document.is_favorite ?? null, 
          created_at: dd.document.created_at,
          updated_at: dd.document.updated_at,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Error retrieving folder:", error);
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

    // Delete folder
    await prisma.folder.delete({
      where: { id: folderId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting folder:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
