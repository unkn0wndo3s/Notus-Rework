import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/../lib/auth";
import { UserService } from "@/lib/services/UserService";

const userService = new UserService();

// Check if user is admin
async function checkAdmin(userId: number | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    return await userService.isUserAdmin(userId);
  } catch (error) {
    console.error("❌ Error verifying admin:", error);
    return false;
  }
}

// GET - Retrieve all settings
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 }
      );
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const settings = await (prisma as any).appSetting.findMany({
      orderBy: { key: "asc" },
    });

    // Convert to key-value object
    // Do not expose sensitive values (tokens, API keys, etc.)
    const settingsMap: Record<string, string> = {};
    const sensitiveKeys = ["ollama_token"];
    
    for (const setting of settings) {
      if (sensitiveKeys.includes(setting.key)) {
        // Do not return sensitive values, just indicate they exist
        settingsMap[setting.key] = setting.value ? "***" : "";
      } else {
        settingsMap[setting.key] = setting.value;
      }
    }

    return NextResponse.json({
      success: true,
      settings: settingsMap,
    });
  } catch (error) {
    console.error("❌ Error GET /api/admin/settings:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

// POST - Update a setting
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 401 }
      );
    }

    const isAdmin = await checkAdmin(userId);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    const { key, value, description } = body as {
      key?: unknown;
      value?: unknown;
      description?: unknown;
    };

    if (typeof key !== "string" || key.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    if (typeof value !== "string") {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 400 }
      );
    }

    // Create or update the setting
    const setting = await (prisma as any).appSetting.upsert({
      where: { key },
      update: {
        value,
        ...(typeof description === "string" ? { description } : {}),
      },
      create: {
        key,
        value,
        description: typeof description === "string" ? description : null,
      },
    });

    return NextResponse.json({
      success: true,
      setting,
    });
  } catch (error) {
    console.error("❌ Error POST /api/admin/settings:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

