import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Check if AI synthesis is enabled (public route for the frontend)
export async function GET(request: NextRequest) {
  try {
    const setting = await (prisma as any).appSetting.findUnique({
      where: { key: "ai_synthesis_enabled" },
    });
    
    const enabled = setting?.value === "true";
    
    return NextResponse.json({
      success: true,
      enabled,
    });
  } catch (error) {
    console.error("❌ Error GET /api/syntheses/status:", error);
    // Default to enabled if setting doesn't exist
    return NextResponse.json({
      success: true,
      enabled: true,
    });
  }
}

