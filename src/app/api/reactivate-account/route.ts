import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

async function tryCreateUserFromDeleted(tx: typeof prisma, record: any, desiredUsername: string | null) {
  // Minimal safe projection from DeletedAccount
  const snapshot = (record.user_snapshot as any) || {};
  const usernameCandidate = desiredUsername || record.username || null;

  const data: any = {
    id: record.original_user_id, // Preserve original user id
    email: record.email,
    username: usernameCandidate,
    first_name: record.first_name || null,
    last_name: record.last_name || null,
    password_hash: snapshot.password_hash || null,
    is_admin: !!record.is_admin,
    email_verified: Boolean(snapshot.email_verified ?? true),
    provider: record.provider || null,
    provider_id: record.provider_id || null,
    is_banned: !!record.is_banned,
    profile_image: record.profile_image || null,
    banner_image: record.banner_image || null,
  };

  return tx.user.create({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
    }

    const record = await prisma.deletedAccount.findFirst({ where: { email } });
    if (!record) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = record.expires_at ?? null;
    const expired = !!(expiresAt && expiresAt.getTime() <= now.getTime());
    if (expired) {
      return NextResponse.json({ success: false, error: "Access denied" }, { status: 410 });
    }

    const snapshot = (record.user_snapshot as any) || {};
    const hasPassword = Boolean(snapshot.password_hash);

    if (hasPassword) {
      if (!password) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 400 });
      }
      const ok = await bcrypt.compare(password, String(snapshot.password_hash));
      if (!ok) {
        return NextResponse.json({ success: false, error: "Access denied" }, { status: 401 });
      }
    }

    // Restore in a transaction, restore documents, and delete the archive
    const restored = await prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tryCreateUserFromDeleted(tx as any, record, record.username || null);
      } catch (e: any) {
        // If username uniqueness fails, fallback to a safe alternative
        const fallbackUsername = `${email.split("@")[0]}_restored`;
        created = await tryCreateUserFromDeleted(tx as any, record, fallbackUsername);
      }

      // Restore documents from trash
      const trashed = await tx.trashDocument.findMany({ where: { user_id: record.original_user_id } });
      if (trashed.length > 0) {
        await tx.document.createMany({
          data: trashed.map((t) => ({
            // do not set id to avoid conflicts; new ids will be assigned
            user_id: t.user_id,
            title: t.title,
            content: t.content,
            tags: t.tags,
            created_at: t.created_at,
          })),
        });
        await tx.trashDocument.deleteMany({ where: { user_id: record.original_user_id } });
      }

      await tx.deletedAccount.delete({ where: { id: record.id } });
      return created;
    });

    return NextResponse.json({ success: true, userId: restored.id });
  } catch (error) {
    console.error("❌ API Error reactivate-account:", error);
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 500 });
  }
}


