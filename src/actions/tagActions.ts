"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/../auth";

/**
 * Retrieves all unique tags for the current user's documents.
 */
export async function getTags() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    const userId = parseInt(session.user.id);

    const documents = await prisma.document.findMany({
      where: { user_id: userId },
      select: { tags: true },
    });

    // Extract all tags and deduplicate them
    const allTags = new Set<string>();
    for (const doc of documents) {
      if (Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          const trimmed = String(tag || "").trim();
          if (trimmed) {
            allTags.add(trimmed);
          }
        }
      }
    }

    // Sort tags alphabetically
    const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b, "en"));

    return {
      success: true,
      tags: sortedTags,
    };
  } catch (error) {
    console.error("❌ Error retrieving tags:", error);
    return { success: false, error: "Failed to retrieve tags", tags: [] };
  }
}
