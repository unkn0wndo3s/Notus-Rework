import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { UserService } from "../../services/UserService";
import { UserValidator } from "../../validators/UserValidator";
import { ActionResult } from "../../types";

export class UserProfileService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async updateUserProfile(_prevState: unknown, formData: FormData): Promise<string> {
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

      await this.userService.initializeTables();

      const userId = Number(String(userIdRaw));
      const result = await this.userService.updateUserProfile(userId, fields);

      if (!result.success) {
        return result.error || "Error during profile update.";
      }

      return "Profile updated successfully!";
    } catch (error: unknown) {
      console.error("❌ Profile update error:", error);
      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }
      return "Error during profile update. Please try again.";
    }
  }

  async getUserProfile(userId: number): Promise<ActionResult> {
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
      await this.userService.initializeTables();

      // Retrieve full user data
      const result = await this.userService.getUserById(userId);

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
      console.error("❌ Error while fetching user profile:", error);
      return {
        success: false,
        error: "Error while fetching profile",
      };
    }
  }

  async getUserIdByEmail(email: string): Promise<ActionResult> {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          userId: "1", // Simulation ID
        };
      }

      // Initialize tables if they don't exist
      await this.userService.initializeTables();

      // Retrieve user ID by email
      const result = await this.userService.getUserByEmail(email);

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
      console.error("❌ Error while fetching user ID:", error);
      return {
        success: false,
        error: "Error while fetching user ID",
      };
    }
  }
}

