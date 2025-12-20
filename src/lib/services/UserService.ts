import bcrypt from "bcryptjs";
import { UserRepository } from "../repositories/UserRepository";
import { EmailService } from "./EmailService";
import { CreateUserData, UpdateUserProfileData, User, UserRepositoryResult } from "../types";
import { NotificationService } from "@/lib/services/NotificationService";


export class UserService {
  private userRepository: UserRepository;
  private emailService: EmailService;

  constructor() {
    this.userRepository = new UserRepository();
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

  async createOAuthUser(userData: {
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    provider: string;
    providerId: string;
  }): Promise<UserRepositoryResult<User>> {
    try {
      // Create OAuth user without password, with email already verified
      const result = await this.userRepository.createUser({
        email: userData.email,
        username: userData.username,
        password: "", // No password for OAuth
        firstName: userData.firstName,
        lastName: userData.lastName,
        verificationToken: "", // No token needed
        emailVerified: true, // Email already verified by Google
        provider: userData.provider,
        providerId: userData.providerId,
      });

      return result;
    } catch (error) {
      console.error("❌ Error creating OAuth user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async verifyUserEmail(token: string): Promise<UserRepositoryResult<{ id: number; email: string; first_name: string }>> {
    try {
      const result = await this.userRepository.verifyUserEmail(token);

      if (result.success && result.data) {
        // Send welcome email
        const emailResult = await this.emailService.sendWelcomeEmail(
          result.data.email,
          result.data.first_name
        );

        if (!emailResult.success) {
          console.error("❌ Error sending welcome email:", emailResult.error);
          // Do not fail verification if email fails
        }
      }

      return result;
    } catch (error) {
      console.error("❌ Error verifying email:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async updateUserProfile(userId: number, fields: UpdateUserProfileData): Promise<UserRepositoryResult<User>> {
    try {
      return await this.userRepository.updateUserProfile(userId, fields);
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

  async getAllUsers(limit: number = 50, offset: number = 0): Promise<UserRepositoryResult<User[]>> {
    try {
      return await this.userRepository.getAllUsers(limit, offset);
    } catch (error) {
      console.error("❌ Error retrieving users:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async toggleUserBan(userId: number, isBanned: boolean, reason?: string): Promise<UserRepositoryResult<{ id: number; email: string; username: string; is_banned: boolean }>> {
    try {
      const result = await this.userRepository.toggleUserBan(userId, isBanned);

      if (result.success && result.data) {
        // Send notification email
        const user = await this.userRepository.getUserById(userId);
        if (user.success && user.user) {
          if (isBanned) {
            await this.emailService.sendBanNotificationEmail(
              user.user.email,
              user.user.first_name || "User",
              reason || null
            );
          } else {
            await this.emailService.sendUnbanNotificationEmail(
              user.user.email,
              user.user.first_name || "User"
            );
          }
        }
      }

      return result;
    } catch (error) {
      console.error("❌ Error banning user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async toggleUserAdmin(userId: number, isAdmin: boolean): Promise<UserRepositoryResult<{ id: number; email: string; username: string; is_admin: boolean }>> {
    try {
      return await this.userRepository.toggleUserAdmin(userId, isAdmin);
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

      // Check if a reset request has been made recently (within the last 5 minutes)
      // This logic should be in the repository, but for simplicity we put it here
      const recentReset = await this.userRepository.query(
        "SELECT reset_token_expiry FROM users WHERE email = $1 AND reset_token_expiry > NOW() - INTERVAL '5 minutes'",
        [email]
      );

      if (recentReset.rows.length > 0) {
        return { success: true };
      }

      // Generate a reset token
      const resetToken = this.emailService.generateVerificationToken();
      const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save token in database
      await this.userRepository.updatePasswordResetToken(user.id, resetToken, resetTokenExpiry);

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
      // Verify token and its validity
      const userResult = await this.userRepository.getUserByResetToken(token);

      if (!userResult.success) {
        return { success: false, error: "Invalid or expired user" };
      }

      const user = userResult.user!;
      const notifSvc = new NotificationService();

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and delete token
      const updateResult = await this.userRepository.updatePassword(user.id, hashedPassword);

      if (!updateResult.success) {
        return { success: false, error: updateResult.error || "Error updating password" };
      }

      await notifSvc.sendPasswordChangeNotification(user.id);

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