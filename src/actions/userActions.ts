"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";
import { UserValidator } from "@/lib/validators/UserValidator";
import { ActionResult } from "@/lib/types";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";

const emailService = new EmailService();

async function getAuthenticatedUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return Number.parseInt(session.user.id);
}

// --- Account Management Actions ---

export async function getProfileImageAction(userId: number) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_image: true },
    });
    return { success: true, profileImage: user?.profile_image };
  } catch (error) {
    return { success: false, error: "Failed to fetch profile image" };
  }
}

export async function checkAdminStatusAction() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { isAdmin: false };
    
    const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { is_admin: true }
    });
    
    return { isAdmin: user?.is_admin === true };
  } catch (error) {
    return { isAdmin: false };
  }
}

export async function deleteAccountAction(password: string) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!process.env.DATABASE_URL) {
      return { success: true, message: "Account deleted (simulation)" };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    if (user.password_hash) {
      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) return { success: false, error: "Incorrect password" };
    }

    // Move to DeletedAccount
    await prisma.$transaction(async (tx) => {
        const snapshot = {
           password_hash: user.password_hash,
           created_at: user.created_at,
           updated_at: user.updated_at
        };

        await tx.deletedAccount.create({
            data: {
                original_user_id: user.id,
                email: user.email,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                provider: user.provider,
                provider_id: user.provider_id,
                profile_image: user.profile_image,
                banner_image: user.banner_image,
                is_admin: user.is_admin,
                is_banned: user.is_banned,
                user_snapshot: snapshot,
                added_at: new Date()
                // expires_at is default calculated by DB but we can set it if needed
            }
        });

        await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting account:", error);
    return { success: false, error: "Failed to delete account" };
  }
}

export async function checkDeletedAccountAction(email: string) {
    try {
        if (!process.env.DATABASE_URL) return { success: false };

        const deleted = await prisma.deletedAccount.findFirst({
            where: { email: email.toLowerCase() }
        });

        if (!deleted) return { success: false, found: false };

        const now = new Date();
        const expired = !!(deleted.expires_at && deleted.expires_at.getTime() <= now.getTime());

        return { 
            success: true, 
            found: true, 
            expired, 
            expiresAt: deleted.expires_at?.toISOString() 
        };
    } catch (e) {
        return { success: false, error: "Error checking deleted account" };
    }
}

export async function reactivateAccountAction(email: string, password?: string) {
    try {
        if (!process.env.DATABASE_URL) return { success: true };

        const deleted = await prisma.deletedAccount.findFirst({
            where: { email: email.toLowerCase() }
        });

        if (!deleted) return { success: false, error: "Account not found in trash" };

        const now = new Date();
        if (deleted.expires_at && deleted.expires_at.getTime() <= now.getTime()) {
            return { success: false, error: "Restoration period expired" };
        }

        const snapshot = (deleted.user_snapshot as any) || {};

        if (snapshot.password_hash && password) {
            const valid = await bcrypt.compare(password, snapshot.password_hash);
            if (!valid) return { success: false, error: "Incorrect password" };
        }

        // Restore
        await prisma.$transaction(async (tx) => {
            await tx.user.create({
                data: {
                    email: deleted.email,
                    username: deleted.username || email.split("@")[0],
                    first_name: deleted.first_name,
                    last_name: deleted.last_name,
                    password_hash: snapshot.password_hash,
                    is_admin: !!deleted.is_admin,
                    email_verified: true,
                    provider: deleted.provider,
                    provider_id: deleted.provider_id,
                    is_banned: !!deleted.is_banned,
                    profile_image: deleted.profile_image,
                    banner_image: deleted.banner_image,
                }
            });
            await tx.deletedAccount.delete({ where: { id: deleted.id } });
        });

        return { success: true };
    } catch (e) {
        console.error("Reactivate error:", e);
        return { success: false, error: "Restoration failed" };
    }
}

export async function verifyEmailAction(token: string) {
    try {
        if (!process.env.DATABASE_URL) return { success: true };

        const user = await prisma.user.findFirst({
            where: { email_verification_token: token }
        });

        if (!user) return { success: false, error: "Invalid token" };

        await prisma.user.update({
            where: { id: user.id },
            data: { 
                email_verified: true,
                email_verification_token: null 
            }
        });

        return { success: true, message: "Email verified" };
    } catch (e) {
        return { success: false, error: "Verification failed" };
    }
}

// --- Registration & Auth Actions ---

export async function registerUser(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const userData = {
      email: formData.get("email") as string,
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
    };

    // Verify acceptance of terms of use
    const acceptTerms = formData.get("acceptTerms");
    if (!acceptTerms) {
      return "You must accept the terms of use and legal notice to register.";
    }

    // Validation
    const validation = UserValidator.validateRegistrationData(userData);
    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    if (!process.env.DATABASE_URL) {
      return "Registration successful (simulation mode).";
    }

    // Check uniqueness
    const existing = await prisma.user.findFirst({
        where: { OR: [{ email: userData.email }, { username: userData.username }] }
    });

    if (existing) {
        if (existing.email === userData.email) return "Email already used.";
        return "Username already taken.";
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const verificationToken = randomBytes(32).toString("hex");

    await prisma.user.create({
        data: {
            email: userData.email,
            username: userData.username,
            password_hash: hashedPassword,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email_verified: false,
            email_verification_token: verificationToken,
            is_admin: false,
            is_banned: false,
            terms_accepted_at: new Date()
        }
    });

    // Send email
    await emailService.sendVerificationEmail(userData.email, verificationToken, userData.firstName);

    return "Registration successful! A verification email has been sent. Check your inbox.";
  } catch (error) {
    console.error("❌ Error during registration:", error);
    return "Error during registration. Please try again.";
  }
}

export async function sendPasswordResetEmailAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const email = formData.get("email") as string;
    if (!email) return "Please enter your email address.";

    const emailValidation = UserValidator.validateEmail(email);
    if (!emailValidation.isValid) return "Please enter a valid email address.";

    if (!process.env.DATABASE_URL) return "Reset email sent (simulation mode).";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return "If an account exists with this email address, a reset link has been sent.";

    const token = randomUUID();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1); // 1 hour

    await prisma.user.update({
        where: { id: user.id },
        data: { 
            reset_token: token,
            reset_token_expiry: expiry 
        }
    });

    await emailService.sendPasswordResetEmail(email, token, user.first_name || user.username || "User");

    return "If an account exists with this email address, a reset link has been sent.";
  } catch (error) {
    console.error("❌ Error sending reset email:", error);
    return "Error sending email. Please try again.";
  }
}

export async function resetPasswordAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!token || !password || !confirmPassword) return "All fields are required.";

    const passwordValidation = UserValidator.validatePasswordResetData(password, confirmPassword);
    if (!passwordValidation.isValid) return Object.values(passwordValidation.errors)[0] || "Invalid data";

    if (!process.env.DATABASE_URL) return "Password changed successfully (simulation mode).";

    const user = await prisma.user.findFirst({
        where: { 
            reset_token: token,
            reset_token_expiry: { gt: new Date() }
        }
    });

    if (!user) return "Invalid or expired token.";

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password_hash: hashedPassword,
            reset_token: null,
            reset_token_expiry: null
        }
    });

    return "Password changed successfully. You can now log in.";
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    return "Error resetting. Please try again.";
  }
}

export async function updateUserProfileAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const userId = await getAuthenticatedUserId();

    const email = formData.get("email") as string || undefined;
    const username = formData.get("username") as string || undefined;
    const firstName = formData.get("firstName") as string || undefined;
    const lastName = formData.get("lastName") as string || undefined;
    const profileImage = formData.get("profileImage") as string || undefined;
    const bannerImage = formData.get("bannerImage") as string || undefined;

    const profileData = {
      email: email?.trim(),
      username: username?.trim(),
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      profileImage,
      bannerImage,
    };

    const validation = UserValidator.validateProfileData(profileData);
    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    if (!process.env.DATABASE_URL) return "Profile updated (simulation mode).";

    const data: any = {};
    if (email) data.email = email.trim();
    if (username) data.username = username.trim();
    if (firstName) data.first_name = firstName.trim();
    if (lastName) data.last_name = lastName.trim();
    if (profileImage !== undefined) data.profile_image = profileImage;
    if (bannerImage !== undefined) data.banner_image = bannerImage;

    if (email || username) {
        // Check uniqueness if changing email/username
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.trim() } : {},
                    username ? { username: username.trim() } : {}
                ],
                NOT: { id: userId }
            }
        });
        if (existing) {
            if (email && existing.email === email) return "Email already used.";
            return "Username already taken.";
        }
    }

    await prisma.user.update({
        where: { id: userId },
        data
    });

    return "Profile updated successfully!";
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    return "Error updating profile. Please try again.";
  }
}

export async function getUserProfileAction(userId: number): Promise<ActionResult> {
  try {
    if (!process.env.DATABASE_URL) return { success: true, user: { id: 1, email: "sim@example.com", email_verified: true, created_at: new Date(), updated_at: new Date(), is_admin: false, is_banned: false } as any }; // simulation

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) return { success: false, error: "User not found" };

    return { success: true, user };
  } catch (error) {
    return { success: false, error: "Error checking profile" };
  }
}

export async function getUserIdByEmailAction(email: string): Promise<ActionResult> {
  try {
     if (!process.env.DATABASE_URL) return { success: true, userId: "1" };

     const user = await prisma.user.findUnique({ where: { email } });
     if (!user) return { success: false, error: "User not found" };
     
     return { success: true, userId: user.id.toString() };
  } catch (error) {
      return { success: false, error: "Error" };
  }
}

export async function getProfileImage(): Promise<{ success: boolean; error?: string; profileImage?: string | null }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }
    
    if (!process.env.DATABASE_URL) {
      return { success: true, profileImage: null };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { profile_image: true }
    });

    return { success: true, profileImage: user?.profile_image };
  } catch (error) {
    return { success: false, error: "Error fetching profile image" };
  }
}

export async function checkAdminStatus(): Promise<{ success: boolean; isAdmin?: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: "Not authenticated" };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, isAdmin: false };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { is_admin: true }
    });

    return { success: true, isAdmin: !!user?.is_admin };
  } catch (error) {
    return { success: false, error: "Error checking admin status" };
  }
}

export async function checkConnectivityAction(): Promise<{ success: boolean; error?: string }> {
  try {
     // Optional: Check DB connection
     if (process.env.DATABASE_URL) {
         await prisma.$queryRaw`SELECT 1`;
     }
     return { success: true };
  } catch (error) {
     return { success: false, error: "Connectivity check failed" };
  }
}
