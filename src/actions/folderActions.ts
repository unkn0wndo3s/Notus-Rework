"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { revalidatePath } from "next/cache";

/**
 * Helper to ensure the user is authenticated and return their ID.
 */
async function getAuthenticatedUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const userId = parseInt(session.user.id);
  if (isNaN(userId)) {
    throw new Error("Invalid user ID");
  }
  return userId;
}

/**
 * Retrieves all folders for the current user.
 */
export async function getFolders() {
  try {
    const userId = await getAuthenticatedUserId();

    const folders = await prisma.folder.findMany({
      where: { user_id: userId },
      include: {
        documents: {
          include: {
            document: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return {
      success: true,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        created_at: f.created_at,
        updated_at: f.updated_at,
        documentCount: f.documents.length,
      })),
    };
  } catch (error) {
    console.error("❌ Error retrieving folders:", error);
    return { success: false, error: "Failed to retrieve folders" };
  }
}

/**
 * Creates a new folder for the current user.
 */
export async function createFolder(name: string) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return { success: false, error: "Invalid name" };
    }

    const folder = await prisma.folder.create({
      data: {
        user_id: userId,
        name: name.trim(),
      },
    });

    revalidatePath("/folders");

    return {
      success: true,
      folder: {
        id: folder.id,
        name: folder.name,
        created_at: folder.created_at,
        updated_at: folder.updated_at,
      },
    };
  } catch (error) {
    console.error("❌ Error creating folder:", error);
    return { success: false, error: "Failed to create folder" };
  }
}

/**
 * Retrieves a specific folder by ID, ensuring ownership.
 */
export async function getFolderById(id: number) {
  try {
    const userId = await getAuthenticatedUserId();

    const folder = await prisma.folder.findFirst({
      where: { id: id, user_id: userId },
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
      return { success: false, error: "Folder not found or access denied" };
    }

    return {
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
    };
  } catch (error) {
    console.error("❌ Error retrieving folder:", error);
    return { success: false, error: "Failed to retrieve folder" };
  }
}

/**
 * Deletes a folder, ensuring ownership.
 */
export async function deleteFolder(id: number) {
  try {
    const userId = await getAuthenticatedUserId();

    // Verify ownership first (Prisma delete requires where with unique input,
    // but the API had requireFolderOwnership which used findFirst)
    const folder = await prisma.folder.findFirst({
      where: { id, user_id: userId },
    });

    if (!folder) {
      return { success: false, error: "Folder not found or access denied" };
    }

    await prisma.folder.delete({
      where: { id },
    });

    revalidatePath("/folders");

    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting folder:", error);
    return { success: false, error: "Failed to delete folder" };
  }
}

/**
 * Adds documents to a folder.
 */
export async function addDocumentsToFolder(
  folderId: number,
  documentIds: number[]
) {
  try {
    const userId = await getAuthenticatedUserId();

    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, user_id: userId },
    });

    if (!folder) {
      return { success: false, error: "Folder access denied" };
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return { success: false, error: "No documents specified" };
    }

    // Check if documents belong to user
    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        user_id: userId,
      },
    });

    if (documents.length !== documentIds.length) {
      return { success: false, error: "Access denied to some documents" };
    }

    // Find already linked documents to avoid duplicates
    const existingLinks = await prisma.folderDocument.findMany({
      where: {
        folder_id: folderId,
        document_id: { in: documentIds },
      },
    });

    const existingDocumentIds = new Set(
      existingLinks.map((link) => link.document_id)
    );
    const newDocumentIds = documentIds.filter(
      (id) => !existingDocumentIds.has(id)
    );

    if (newDocumentIds.length > 0) {
      await prisma.folderDocument.createMany({
        data: newDocumentIds.map((docId) => ({
          folder_id: folderId,
          document_id: docId,
        })),
      });
    }

    revalidatePath(`/folders/${folderId}`);

    return { success: true, added: newDocumentIds.length };
  } catch (error) {
    console.error("❌ Error adding documents to folder:", error);
    return { success: false, error: "Failed to add documents" };
  }
}

/**
 * Removes documents from a folder.
 */
export async function removeDocumentsFromFolder(
  folderId: number,
  documentIds: number[]
) {
  try {
    const userId = await getAuthenticatedUserId();

    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, user_id: userId },
    });

    if (!folder) {
      return { success: false, error: "Folder access denied" };
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return { success: false, error: "No documents specified" };
    }

    await prisma.folderDocument.deleteMany({
      where: {
        folder_id: folderId,
        document_id: { in: documentIds },
      },
    });

    revalidatePath(`/folders/${folderId}`);

    return { success: true };
  } catch (error) {
    console.error("❌ Error removing documents from folder:", error);
    return { success: false, error: "Failed to remove documents" };
  }
}
