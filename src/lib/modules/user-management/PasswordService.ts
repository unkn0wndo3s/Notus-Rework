import { UserService } from "../../services/UserService";
import { UserValidator } from "../../validators/UserValidator";

export class PasswordService {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async sendPasswordResetEmail(_prevState: unknown, formData: FormData): Promise<string> {
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
      await this.userService.initializeTables();

      // Send reset email
      const result = await this.userService.sendPasswordResetEmail(email);

      if (!result.success) {
        return result.error || "Error while sending email";
      }

      return "If an account exists with this email address, a reset link has been sent.";
    } catch (error: unknown) {
      console.error("❌ Error while sending reset email:", error);

      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }

      return "Error while sending email. Please try again.";
    }
  }

  async resetPassword(_prevState: unknown, formData: FormData): Promise<string> {
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
      await this.userService.initializeTables();

      // Reset password
      const result = await this.userService.resetPassword(token, password);

      if (!result.success) {
        return result.error || "Error while resetting password";
      }

      return "Password changed successfully. You can now log in.";
    } catch (error: unknown) {
      console.error("❌ Error while resetting password:", error);

      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }

      return "Error while resetting. Please try again.";
    }
  }
}

