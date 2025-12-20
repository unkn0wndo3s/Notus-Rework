"use server";

import { UserService } from "@/lib/services/UserService";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { EmailService } from "@/lib/services/EmailService";
import { ActionResult } from "@/lib/types";

const userService = new UserService();

async function getAuthenticatedUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return Number.parseInt(session.user.id);
}

/**
 * Gets the profile image URL for the current user.
 */
export async function getProfileImage(): Promise<ActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    const result = await userService.getUserById(userId);

    if (!result.success || !result.user) {
      return { success: false, error: "User not found" };
    }

    return { 
      success: true, 
      profileImage: result.user.profile_image 
    };
  } catch (error) {
    console.error("❌ Error getting profile image:", error);
    return { success: false, error: "Failed to get profile image" };
  }
}

/**
 * Checks if the current user is an admin.
 */
export async function checkAdminStatus(): Promise<ActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    const isAdmin = await userService.isUserAdmin(userId);

    return { 
      success: true, 
      isAdmin 
    };
  } catch (error) {
    console.error("❌ Error checking admin status:", error);
    return { success: false, isAdmin: false };
  }
}

/**
 * Checks connectivity.
 */
export async function checkConnectivityAction(): Promise<{ success: boolean }> {
  return { success: true };
}

/**
 * Deletes the current user's account (schedules for deletion).
 */
export async function deleteAccountAction(password: string): Promise<ActionResult> {
  try {
    const userId = await getAuthenticatedUserId();
    
    if (!password) {
      return { success: false, error: "Password is required" };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (!user.password_hash) {
      return { success: false, error: "Account has no password (provider login?)" };
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return { success: false, error: "Incorrect password" };
    }

    // Immediate deletion: archive documents, archive user, then delete user
    await prisma.$transaction(async (tx) => {
      // 1) Archive user's documents into trash_documents
      const docs = await tx.document.findMany({ where: { user_id: user.id } });
      if (docs.length > 0) {
        await tx.trashDocument.createMany({
          data: docs.map((d) => ({
            original_id: d.id,
            user_id: d.user_id,
            title: d.title,
            content: d.content,
            tags: d.tags,
            created_at: d.created_at,
            updated_at: d.updated_at,
            deleted_at: new Date(),
          })),
        });
      }

      // 2) Archive the user
      await tx.deletedAccount.create({
        data: {
          original_user_id: user.id,
          email: user.email,
          username: user.username || null,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          provider: user.provider || null,
          provider_id: user.provider_id || null,
          profile_image: user.profile_image || null,
          banner_image: user.banner_image || null,
          is_admin: user.is_admin,
          is_banned: user.is_banned,
          user_snapshot: user as any,
        },
      });

      // 3) Delete the user
      await tx.user.delete({ where: { id: user.id } });
    });

    const emailService = new EmailService();
    await emailService.sendDeletionCompletedEmail(
      user.email,
      user.first_name || "User"
    );

    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting account:", error);
    return { success: false, error: "Failed to delete account" };
  }
}

/**
 * Checks if an account is deleted and can be restored.
 */
export async function checkDeletedAccountAction(email: string): Promise<ActionResult> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Email is required" };
    }

    const record = await prisma.deletedAccount.findFirst({ where: { email: cleanEmail } });
    if (!record) {
      return { success: true, found: false };
    }

    const now = new Date();
    const expiresAt = record.expires_at ?? null;
    const expired = !!(expiresAt && expiresAt.getTime() <= now.getTime());

    if (expired) {
      await prisma.$transaction(async (tx) => {
        await tx.trashDocument.deleteMany({ where: { user_id: record.original_user_id } });
        await tx.deletedAccount.delete({ where: { id: record.id } });
      });
      return {
        success: true,
        found: true,
        expired: true,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
      };
    }

    return {
      success: true,
      found: true,
      expired: false,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };
  } catch (error) {
    console.error("❌ Error checking deleted account:", error);
    return { success: false, error: "Failed to check account" };
  }
}

/**
 * Reactivates a deleted account.
 */
export async function reactivateAccountAction(email: string, password: string): Promise<ActionResult> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Email is required" };
    }

    const record = await prisma.deletedAccount.findFirst({ where: { email: cleanEmail } });
    if (!record) {
      return { success: false, error: "Account not found in archives" };
    }

    const now = new Date();
    const expiresAt = record.expires_at ?? null;
    const expired = !!(expiresAt && expiresAt.getTime() <= now.getTime());
    if (expired) {
      return { success: false, error: "Restoration period expired" };
    }

    const snapshot = (record.user_snapshot as any) || {};
    const hasPassword = Boolean(snapshot.password_hash);

    if (hasPassword) {
      if (!password) {
        return { success: false, error: "Password is required" };
      }
      const ok = await bcrypt.compare(password, String(snapshot.password_hash));
      if (!ok) {
        return { success: false, error: "Incorrect password" };
      }
    }

    const restored = await prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tryCreateUserFromDeleted(tx as any, record, record.username || null);
      } catch (e) {
         console.warn("Retrying creation with fallback username", e);
         // Fallback username
        const fallbackUsername = `${cleanEmail.split("@")[0]}_restored`;
        created = await tryCreateUserFromDeleted(tx as any, record, fallbackUsername);
      }

      const trashed = await tx.trashDocument.findMany({ where: { user_id: record.original_user_id } });
      if (trashed.length > 0) {
        await tx.document.createMany({
          data: trashed.map((t) => ({
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

    return { success: true, userId: String(restored.id) };
  } catch (error) {
    console.error("❌ Error reactivating account:", error);
    return { success: false, error: "Failed to reactivate account" };
  }
}

async function tryCreateUserFromDeleted(tx: any, record: any, desiredUsername: string | null) {
  const snapshot = (record.user_snapshot as any) || {};
  const usernameCandidate = desiredUsername || record.username || null;

  return tx.user.create({
    data: {
      id: record.original_user_id,
      email: record.email,
      username: usernameCandidate,
      first_name: record.first_name || null,
      last_name: record.last_name || null,
      password_hash: snapshot.password_hash || null,
      is_admin: !!record.is_admin,
      email_verified: Boolean(snapshot.email_verified),
      provider: record.provider || null,
      provider_id: record.provider_id || null,
      is_banned: !!record.is_banned,
      profile_image: record.profile_image || null,
      banner_image: record.banner_image || null,
    },
  });
}

/**
 * Verifies a user's email with a token.
 */
export async function verifyEmailAction(token: string) {
  try {
    if (!token) {
      return { success: false, error: "Access denied" };
    }

    const result = await userService.verifyUserEmail(token);

    if (!result.success) {
      return { success: false, error: "Access denied" };
    }

    return {
      success: true,
      message: `Welcome ${result.data!.first_name}! Your account has been successfully activated.`,
    };
  } catch (error) {
    console.error("❌ Error verifyEmailAction:", error);
    return { success: false, error: "Access denied" };
  }
}
