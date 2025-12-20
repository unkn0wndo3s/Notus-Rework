import { getServerSession } from "next-auth";
import { signIn } from "next-auth/react";
import { authOptions } from "../../../../lib/auth";
import { UserService } from "../../services/UserService";
import { UserValidator } from "../../validators/UserValidator";
import { ActionResult } from "../../types";

export class AuthService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async authenticate(_prevState: unknown, formData: FormData): Promise<string> {
    try {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;

      if (!email || !password) {
        return "Email and password required";
      }

      // Check if user is banned before login attempt
      const userResult = await this.userService.getUserByEmail(email);
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
        return "Incorrect email or password, or unverified email.";
      }

      return "An error has occurred.";
    }
  }

  async registerUser(_prevState: unknown, formData: FormData): Promise<string> {
    try {
      const userData = {
        email: formData.get("email") as string,
        username: formData.get("username") as string,
        password: formData.get("password") as string,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
      };

      // Check acceptance of terms of use
      const acceptTerms = formData.get("acceptTerms");
      if (!acceptTerms) {
        return "You must accept the terms of use and legal notices to register.";
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
      await this.userService.initializeTables();

      // Create user
      const result = await this.userService.createUser(userData);

      if (!result.success) {
        return result.error || "Error during registration";
      }

      return "Registration successful! A verification email has been sent. Check your inbox.";
    } catch (error: unknown) {
      console.error("❌ Registration error:", error);

    if (error instanceof Error && (error.message.includes("already used") || error.message.includes("already exists"))) {
      return error.message;
    }

      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }

      return "Error during registration. Please try again.";
    }
  }

  async getCurrentUser(): Promise<ActionResult> {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.id) {
        return {
          success: false,
          error: "User not logged in",
        };
      }

      const userId = Number(session.user.id);
      return await this.userService.getUserById(userId);
    } catch (error: unknown) {
      console.error("❌ Error while fetching current user:", error);
      return {
        success: false,
        error: "Error while fetching user",
      };
    }
  }
}

