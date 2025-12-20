import bcrypt from "bcryptjs";
import { PrismaUserRepository } from "../repositories/PrismaUserRepository";
import { EmailService } from "./EmailService";
import { CreateUserData, UpdateUserProfileData, User, UserRepositoryResult } from "../types";

export class PrismaUserService {
  private userRepository: PrismaUserRepository;
  private emailService: EmailService;

  constructor() {
    this.userRepository = new PrismaUserRepository();
    this.emailService = new EmailService();
  }

  async initializeTables(): Promise<void> {
    await this.userRepository.initializeTables();
  }

  async createUser(userData: Omit<CreateUserData, 'verificationToken'>): Promise<UserRepositoryResult<User>> {
    try {
      // Generate a verification token
      const verificationToken = this.emailService.generateVerificationToken();

      const createUserData: CreateUserData = {
        ...userData,
        verificationToken,
      };

      // Create the user
      const result = await this.userRepository.createUser(createUserData);

      if (!result.success) {
        return result;
      }

      // Send verification email
      const emailResult = await this.emailService.sendVerificationEmail(
        userData.email,
        verificationToken,
        userData.firstName
      );

      if (!emailResult.success) {
        console.error("❌ Error sending email:", emailResult.error);
        // Do not fail user creation if email fails
      }

      return result;
    } catch (error) {
      console.error("❌ Error creating user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async verifyUserEmail(token: string): Promise<UserRepositoryResult<User>> {
    try {
      const result = await this.userRepository.verifyEmail(token);

      if (result.success && result.user) {
        // Send welcome email
        const emailResult = await this.emailService.sendWelcomeEmail(
          result.user.email,
          result.user.first_name || "User"
        );

        if (!emailResult.success) {
          console.error("❌ Error sending welcome email:", emailResult.error);
          // Do not fail verification if email fails
        }

        return result;
      }

      return result;
    } catch (error) {
      console.error("❌ Error verifying email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async updateUserProfile(userId: number, fields: UpdateUserProfileData): Promise<UserRepositoryResult<User>> {
    try {
      return await this.userRepository.updateUser(userId, fields);
    } catch (error) {
      console.error("❌ Error updating profile:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserById(userId: number): Promise<UserRepositoryResult<User>> {
    try {
      return await this.userRepository.getUserById(userId);
    } catch (error) {
      console.error("❌ Error retrieving user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserByEmail(email: string): Promise<UserRepositoryResult<User>> {
    try {
      return await this.userRepository.getUserByEmail(email);
    } catch (error) {
      console.error("❌ Error retrieving user by email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getAllUsers(): Promise<UserRepositoryResult<User[]>> {
    try {
      return await this.userRepository.getAllUsers();
    } catch (error) {
      console.error("❌ Error retrieving users:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async toggleUserBan(userId: number, isBanned: boolean, reason?: string): Promise<UserRepositoryResult<User>> {
    try {
      const result = await this.userRepository.toggleBan(userId, isBanned);

      if (result.success && result.user) {
        // Send notification email
        if (isBanned) {
          await this.emailService.sendBanNotificationEmail(
            result.user.email,
            result.user.first_name || "User",
            reason || "No reason specified"
          );
        } else {
          await this.emailService.sendUnbanNotificationEmail(
            result.user.email,
            result.user.first_name || "User"
          );
        }

        return result;
      }

      return result;
    } catch (error) {
      console.error("❌ Error banning user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async toggleUserAdmin(userId: number, isAdmin: boolean): Promise<UserRepositoryResult<User>> {
    try {
      const result = await this.userRepository.toggleAdmin(userId, isAdmin);

      if (result.success && result.user) {
        return result;
      }

      return result;
    } catch (error) {
      console.error("❌ Error changing admin status:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async isUserAdmin(userId: number): Promise<boolean> {
    try {
      return await this.userRepository.isUserAdmin(userId);
    } catch (error) {
      console.error("❌ Error verifying admin status:", error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const userResult = await this.userRepository.getUserByEmail(email);
      
      if (!userResult.success) {
        // For security reasons, do not reveal if email exists or not
        return { success: true };
      }

      const user = userResult.user!;

      // Generate a reset token
      const resetToken = this.emailService.generateVerificationToken();
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save token in database
      await this.userRepository.updatePasswordResetToken(email, resetToken, resetTokenExpiry);

      // Send reset email
      const emailResult = await this.emailService.sendPasswordResetEmail(
        email,
        resetToken,
        user.first_name || "User"
      );

      if (!emailResult.success) {
        console.error("❌ Error sending email:", emailResult.error);
        return { success: false, error: "Error sending email" };
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Error sending reset email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and delete token
      const updateResult = await this.userRepository.updatePassword(token, hashedPassword);

      if (!updateResult.success) {
        return { success: false, error: updateResult.error || "Error updating password" };
      }

      // Create an in-app notification informing the user their password was changed
      try {
        const notifSvc = new (await import("./NotificationService")).NotificationService();
        if (updateResult.user) {
          await notifSvc.sendNotification(null, updateResult.user.id, {
            type: "password-changed",
            message: "Your password has been changed.",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("Could not create password-changed notification:", e);
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Error resetting password:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async authenticateUser(identifier: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const userResult = await this.userRepository.getUserByEmail(identifier);

      if (!userResult.success) {
        return { success: false, error: "Invalid credentials" };
      }

      const user = userResult.user!;

      if (user.is_banned) {
        return { success: false, error: "This account has been banned" };
      }

      if (!user.password_hash) {
        return { success: false, error: "OAuth account without password" };
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        return { success: false, error: "Invalid credentials" };
      }

      if (!user.email_verified) {
        return { success: false, error: "Email not verified" };
      }

      return { success: true, user };
    } catch (error) {
      console.error("❌ Error authenticating:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}