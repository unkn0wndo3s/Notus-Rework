import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const record = await prisma.deletedAccount.findFirst({ where: { email } });
    if (!record) {
      return NextResponse.json({ success: true, found: false });
    }

    const now = new Date();
    const expiresAt = record.expires_at ?? null;
    const expired = !!(expiresAt && expiresAt.getTime() <= now.getTime());

    if (expired) {
      // Purge archived data if retention window elapsed
      await prisma.$transaction(async (tx) => {
        await tx.trashDocument.deleteMany({ where: { user_id: record.original_user_id } });
        await tx.deletedAccount.delete({ where: { id: record.id } });
      });
      return NextResponse.json({
        success: true,
        found: true,
        expired: true,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      });
    }

    return NextResponse.json({
      success: true,
      found: true,
      expired: false,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
  } catch (error) {
    console.error("❌ API Error check-deleted-account:", error);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}


