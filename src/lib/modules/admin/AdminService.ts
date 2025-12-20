import { UserService } from "../../services/UserService";
import { ActionResult } from "../../types";

export class AdminService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getAllUsers(): Promise<ActionResult> {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          users: [
            {
              id: 1,
              email: "admin@example.com",
              username: "admin",
              first_name: "Admin",
              last_name: "User",
              email_verified: true,
              is_admin: true,
              is_banned: false,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }

      // Initialize tables if they don't exist
      await this.userService.initializeTables();

      // Retrieve all users
      const result = await this.userService.getAllUsers();

      if (!result.success) {
        console.error("❌ Error retrieving users:", result.error);
        return {
          success: false,
          error: "Error while retrieving users.",
          users: [],
        };
      }

      return {
        success: true,
        users: result.users || [],
      };
    } catch (error: unknown) {
      console.error("❌ Error while retrieving users:", error);
      return {
        success: false,
        error: "Error while retrieving users.",
        users: [],
      };
    }
  }

  async toggleUserBan(userId: number): Promise<ActionResult> {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          message: "Ban status modified (simulation mode).",
        };
      }

      // Initialize tables if they don't exist
      await this.userService.initializeTables();

      // Toggle ban status
      const result = await this.userService.toggleUserBan(userId, true);

      if (!result.success) {
        console.error("❌ Error toggling ban:", result.error);
        return {
          success: false,
          error: result.error || "Error while modifying ban status.",
        };
      }

      return {
        success: true,
        message: "Ban status successfully modified.",
      };
    } catch (error: unknown) {
      console.error("❌ Error while modifying ban status:", error);
      return {
        success: false,
        error: "Error while modifying ban status.",
      };
    }
  }

  async toggleUserAdmin(userId: number): Promise<ActionResult> {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          message: "Admin status modified (simulation mode).",
        };
      }

      // Initialize tables if they don't exist
      await this.userService.initializeTables();

      // Toggle admin status
      const result = await this.userService.toggleUserAdmin(userId, true);

      if (!result.success) {
        console.error("❌ Error toggling admin:", result.error);
        return {
          success: false,
          error: result.error || "Error while modifying admin status.",
        };
      }

      return {
        success: true,
        message: "Admin status successfully modified.",
      };
    } catch (error: unknown) {
      console.error("❌ Error while modifying admin status:", error);
      return {
        success: false,
        error: "Error while modifying admin status.",
      };
    }
  }

  async isUserAdmin(userId: number): Promise<boolean> {
    try {
      // Check if database is configured
      if (!process.env.DATABASE_URL) {
        return userId === 1; // Simulation : only user 1 is admin
      }

      // Initialize tables if they don't exist
      await this.userService.initializeTables();

      // Check admin status
      const result = await this.userService.isUserAdmin(userId);

      return result;
    } catch (error: unknown) {
      console.error("❌ Error while checking admin status:", error);
      return false;
    }
  }
}

