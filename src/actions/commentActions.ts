"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";
import { DocumentService } from "@/lib/services/DocumentService";
import { revalidatePath } from "next/cache";

const documentService = new DocumentService();

/**
 * Helper to ensure the user is authenticated and return their credentials.
 */
async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return {
    userId: Number.parseInt(session.user.id),
    email: session.user.email as string | undefined,
  };
}

/**
 * Retrieves comments for a specific document.
 */
export async function getComments(documentId: number) {
  try {
    const { userId, email } = await getAuthenticatedUser();

    if (!documentId || documentId <= 0) {
      return { success: false, error: "Invalid document ID" };
    }

    // Verify access to the document
    const hasAccess = await documentService.userHasAccessToDocument(
      documentId,
      userId,
      email
    );

    if (!hasAccess) {
      return { success: false, error: "Access denied" };
    }

    const comments = await (prisma as any).comment.findMany({
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

    return {
      success: true,
      comments,
    };
  } catch (error) {
    console.error("❌ Error retrieving comments:", error);
    return { success: false, error: "Failed to retrieve comments" };
  }
}

/**
 * Creates a new comment on a document.
 */
export async function createComment(documentId: number, content: string) {
  try {
    const { userId, email } = await getAuthenticatedUser();

    if (!documentId || documentId <= 0) {
      return { success: false, error: "Invalid document ID" };
    }

    if (typeof content !== "string" || content.trim().length === 0) {
      return { success: false, error: "Comment content cannot be empty" };
    }

    const trimmed = content.trim();
    if (trimmed.length > 2000) {
      return { success: false, error: "Comment too long (max 2000 chars)" };
    }

    // Verify access to the document
    const hasAccess = await documentService.userHasAccessToDocument(
      documentId,
      userId,
      email
    );

    if (!hasAccess) {
      return { success: false, error: "Access denied" };
    }

    const comment = await (prisma as any).comment.create({
      data: {
        document_id: documentId,
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

    revalidatePath(`/documents/${documentId}`); // Assuming this is where comments are shown

    return {
      success: true,
      comment,
    };
  } catch (error) {
    console.error("❌ Error creating comment:", error);
    return { success: false, error: "Failed to create comment" };
  }
}
