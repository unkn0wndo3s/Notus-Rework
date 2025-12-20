import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security/routeGuards";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Using prisma.folder
    const folders = await prisma.folder.findMany({
      where: { user_id: authResult.userId },
      include: {
        documents: {
          include: {
            document: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({
      success: true,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        created_at: f.created_at,
        updated_at: f.updated_at,
        documentCount: f.documents.length,
      })),
    });
  } catch (error) {
    console.error("❌ Error retrieving folders:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid name" },
        { status: 400 }
      );
    }

    // Using prisma.folder
    const folder = await prisma.folder.create({
      data: {
        user_id: authResult.userId,
        name: name.trim(),
      },
    });

    return NextResponse.json(
      { 
        success: true, 
        folder: { 
          id: folder.id, 
          name: folder.name, 
          created_at: folder.created_at, 
          updated_at: folder.updated_at 
        } 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error creating folder:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}
