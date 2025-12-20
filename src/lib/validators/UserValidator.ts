import { ValidationResult } from "../types";

export class UserValidator {
  static validateEmail(email: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!email || email.trim().length === 0) {
      errors.email = "Email is required";
      return { isValid: false, errors };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = "Email is not valid";
      return { isValid: false, errors };
    }

    if (email.length > 255) {
      errors.email = "Email cannot exceed 255 characters";
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validateUsername(username: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!username || username.trim().length === 0) {
      errors.username = "Username is required";
      return { isValid: false, errors };
    }

    if (username.length < 3) {
      errors.username = "Username must contain at least 3 characters";
      return { isValid: false, errors };
    }

    if (username.length > 50) {
      errors.username = "Username cannot exceed 50 characters";
      return { isValid: false, errors };
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      errors.username = "Username can only contain letters, numbers, dashes and underscores";
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validatePassword(password: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!password || password.length === 0) {
      errors.password = "Password is required";
      return { isValid: false, errors };
    }

    if (password.length < 6) {
      errors.password = "Password must contain at least 6 characters";
      return { isValid: false, errors };
    }

    if (password.length > 128) {
      errors.password = "Password cannot exceed 128 characters";
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validateName(name: string, fieldName: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!name || name.trim().length === 0) {
      errors[fieldName] = `${fieldName} is required`;
      return { isValid: false, errors };
    }

    if (name.length > 100) {
      errors[fieldName] = `${fieldName} cannot exceed 100 characters`;
      return { isValid: false, errors };
    }

    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(name)) {
      errors[fieldName] = `${fieldName} can only contain letters, spaces, apostrophes and dashes`;
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validateRegistrationData(userData: {
    email: string;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    // Validate email
    const emailValidation = this.validateEmail(userData.email);
    if (!emailValidation.isValid) {
      Object.assign(errors, emailValidation.errors);
    }

    // Validate username
    const usernameValidation = this.validateUsername(userData.username);
    if (!usernameValidation.isValid) {
      Object.assign(errors, usernameValidation.errors);
    }

    // Validate password
    const passwordValidation = this.validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      Object.assign(errors, passwordValidation.errors);
    }

    // Validate first name
    const firstNameValidation = this.validateName(userData.firstName, "first_name");
    if (!firstNameValidation.isValid) {
      Object.assign(errors, firstNameValidation.errors);
    }

    // Validate last name
    const lastNameValidation = this.validateName(userData.lastName, "last_name");
    if (!lastNameValidation.isValid) {
      Object.assign(errors, lastNameValidation.errors);
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateProfileData(profileData: {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    bannerImage?: string;
  }): ValidationResult {
    const errors: Record<string, string> = {};

    // Validate email if provided
    if (profileData.email !== undefined) {
      const emailValidation = this.validateEmail(profileData.email);
      if (!emailValidation.isValid) {
        Object.assign(errors, emailValidation.errors);
      }
    }

    // Validate username if provided
    if (profileData.username !== undefined) {
      const usernameValidation = this.validateUsername(profileData.username);
      if (!usernameValidation.isValid) {
        Object.assign(errors, usernameValidation.errors);
      }
    }

    // Validate first name if provided
    if (profileData.firstName !== undefined) {
      const firstNameValidation = this.validateName(profileData.firstName, "first_name");
      if (!firstNameValidation.isValid) {
        Object.assign(errors, firstNameValidation.errors);
      }
    }

    // Validate last name if provided
    if (profileData.lastName !== undefined) {
      const lastNameValidation = this.validateName(profileData.lastName, "last_name");
      if (!lastNameValidation.isValid) {
        Object.assign(errors, lastNameValidation.errors);
      }
    }

    // Image validation if provided
    // Character limit removed to allow longer image URLs

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validatePasswordResetData(password: string, confirmPassword: string): ValidationResult {
    const errors: Record<string, string> = {};

    // Validate password
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      Object.assign(errors, passwordValidation.errors);
    }

    // Verify that passwords match
    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }
}

