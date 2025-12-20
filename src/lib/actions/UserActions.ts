"use server";

import { signIn } from "next-auth/react";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { UserService } from "../services/UserService";
import { UserValidator } from "../validators/UserValidator";
import { ActionResult } from "../types";

const userService = new UserService();

export async function authenticate(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return "Email and password required";
    }

    // Check if user is banned before login attempt
    const userResult = await userService.getUserByEmail(email);
    if (userResult.success && userResult.user?.is_banned) {
      return "This account has been banned. Contact an administrator for more information.";
    }

    await signIn("credentials", {
      email,
      password,
    });

    return "";
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'type' in error && error.type === "CredentialsSignin") {
      return "Incorrect email or password, or email not verified.";
    }

    return "An error occurred.";
  }
}

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

    // Server-side validation
    const validation = UserValidator.validateRegistrationData(userData);
    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Registration successful (simulation mode). Configure DATABASE_URL for persistence.";
    }

    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Create user
    const result = await userService.createUser(userData);

    if (!result.success) {
      return result.error || "Error during registration";
    }

    return "Registration successful! A verification email has been sent. Check your inbox.";
  } catch (error: unknown) {
    console.error("❌ Error during registration:", error);

    if (error instanceof Error && (error.message.includes("already used") || error.message.includes("already exists"))) {
      // return "Email or username already used."; // More generic in English
      return error.message; 
    }

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error during registration. Please try again.";
  }
}

export async function sendPasswordResetEmailAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const email = formData.get("email") as string;

    if (!email) {
      return "Please enter your email address.";
    }

    // Basic email validation
    const emailValidation = UserValidator.validateEmail(email);
    if (!emailValidation.isValid) {
      return "Please enter a valid email address.";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Reset email sent (simulation mode). Configure DATABASE_URL for persistence.";
    }

    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Send reset email
    const result = await userService.sendPasswordResetEmail(email);

    if (!result.success) {
      return result.error || "Error sending email";
    }

    return "If an account exists with this email address, a reset link has been sent.";
  } catch (error: unknown) {
    console.error("❌ Error sending reset email:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error sending email. Please try again.";
  }
}

export async function resetPasswordAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!token || !password || !confirmPassword) {
      return "All fields are required.";
    }

    // Password validation
    const passwordValidation = UserValidator.validatePasswordResetData(password, confirmPassword);
    if (!passwordValidation.isValid) {
      return Object.values(passwordValidation.errors)[0] || "Invalid data";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Password changed successfully (simulation mode). Configure DATABASE_URL for persistence.";
    }

    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Reset password
    const result = await userService.resetPassword(token, password);

    if (!result.success) {
      return result.error || "Error resetting password";
    }

    return "Password changed successfully. You can now log in.";
  } catch (error: unknown) {
    console.error("❌ Error resetting password:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error resetting. Please try again.";
  }
}

export async function updateUserProfileAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
      const session = await getServerSession(authOptions);
    const userIdRaw = session?.user?.id;

    if (!userIdRaw) {
      return "You must be logged in to modify your profile.";
    }

    const email = formData.get("email") as string || undefined;
    const username = formData.get("username") as string || undefined;
    const firstName = formData.get("firstName") as string || undefined;
    const lastName = formData.get("lastName") as string || undefined;
    const profileImage = formData.get("profileImage") as string || undefined;
    const bannerImage = formData.get("bannerImage") as string || undefined;

    // Profile data validation
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

    const fields: Record<string, string> = {};
    if (email !== undefined) fields.email = email.trim();
    if (username !== undefined) fields.username = username.trim();
    if (firstName !== undefined) fields.firstName = firstName.trim();
    if (lastName !== undefined) fields.lastName = lastName.trim();
    if (profileImage !== undefined) fields.profileImage = profileImage;
    if (bannerImage !== undefined) fields.bannerImage = bannerImage;

    if (Object.keys(fields).length === 0) {
      return "No changes detected.";
    }

    if (!process.env.DATABASE_URL) {
      return "Profile updated (simulation mode). Configure DATABASE_URL for persistence.";
    }

    await userService.initializeTables();

    const userId = parseInt(String(userIdRaw));
    const result = await userService.updateUserProfile(userId, fields);

    if (!result.success) {
      return result.error || "Error updating profile.";
    }

    return "Profile updated successfully!";
  } catch (error: unknown) {
    console.error("❌ Error updating profile:", error);
    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }
    return "Error updating profile. Please try again.";
  }
}

export async function getUserProfileAction(userId: number): Promise<ActionResult> {
  try {
    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return {
        success: true,
        user: {
          id: userId,
          email: "test@example.com",
          username: "simulation",
          password_hash: undefined,
          first_name: "Test",
          last_name: "User",
          email_verified: true,
          email_verification_token: undefined,
          provider: undefined,
          provider_id: undefined,
          created_at: new Date(),
          updated_at: new Date(),
          reset_token: undefined,
          reset_token_expiry: undefined,
          is_admin: false,
          is_banned: false,
          terms_accepted_at: new Date(),
          profile_image: undefined,
          banner_image: undefined,
        },
      };
    }

    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Retrieve user profile
    const result = await userService.getUserById(userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "User not found",
      };
    }

    return {
      success: true,
      user: result.user,
    };
  } catch (error: unknown) {
    console.error("❌ Error retrieving user profile:", error);
    return {
      success: false,
      error: "Error retrieving profile",
    };
  }
}

export async function getUserIdByEmailAction(email: string): Promise<ActionResult> {
  try {
    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return {
        success: true,
        userId: "1", // Simulation ID
      };
    }

    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Retrieve user ID by email
    const result = await userService.getUserByEmail(email);

    if (!result.success) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return {
      success: true,
      userId: result.user!.id.toString(),
    };
  } catch (error: unknown) {
    console.error("❌ Error retrieving user ID:", error);
    return {
      success: false,
      error: "Error retrieving user ID",
    };
  }
}