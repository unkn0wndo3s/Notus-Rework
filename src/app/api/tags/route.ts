import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security/routeGuards";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const documents = await prisma.document.findMany({
      where: { user_id: authResult.userId },
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

    return NextResponse.json({
      success: true,
      tags: sortedTags,
    });
  } catch (error) {
    console.error("❌ Error retrieving tags:", error);
    return NextResponse.json(
      { success: false, error: "Access denied", tags: [] },
      { status: 500 }
    );
  }
}

