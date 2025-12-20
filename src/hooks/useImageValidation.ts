"use client";

import { useState, useCallback } from "react";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ProfileData {
  profileImage?: string;
  bannerImage?: string;
  [key: string]: any;
}

interface UseImageValidationReturn {
  errors: Record<string, string | null>;
  validateImage: (base64: string, fieldName: string) => ValidationResult;
  validateProfileImages: (profileData: ProfileData) => ValidationResult;
  clearError: (fieldName: string) => void;
  clearAllErrors: () => void;
}

// Client-side validation for base64 images
const validateBase64Image = (base64: string, fieldName: string): ValidationResult => {
  const errors: string[] = [];

  if (base64 && base64.trim() !== "") {
    // Check base64 format
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif);base64,/;
    if (base64Regex.test(base64)) {
      // Check that base64 data is valid
      const base64Data = base64.split(",")[1];
      if (!base64Data || base64Data.length === 0) {
        errors.push(`${fieldName} contains invalid base64 data`);
      } else {
        // Check that it's valid base64
        try {
          atob(base64Data);
        } catch {
          errors.push(`${fieldName} contains corrupted base64 data`);
        }
      }
    } else {
      errors.push(
        `${fieldName} must be a valid base64 image (JPEG, PNG, or GIF)`
      );
    }

    // Check size (limit to 10MB to avoid performance issues)
    if (base64.length > 13.3 * 1024 * 1024) {
      // 10MB in base64 ≈ 13.3MB
      errors.push(`${fieldName} is too large (maximum 10MB)`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export function useImageValidation(): UseImageValidationReturn {
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const validateImage = useCallback((base64: string, fieldName: string): ValidationResult => {
    const validation = validateBase64Image(base64, fieldName);

    setErrors((prev) => ({
      ...prev,
      [fieldName]: validation.isValid ? null : validation.errors[0],
    }));

    return validation;
  }, []);

  const validateProfileImages = useCallback((profileData: ProfileData): ValidationResult => {
    const newErrors: Record<string, string | null> = {};

    // Profile image validation
    if (profileData.profileImage) {
      const profileValidation = validateBase64Image(
        profileData.profileImage,
        "Profile image"
      );
      if (!profileValidation.isValid) {
        newErrors.profileImage = profileValidation.errors[0];
      }
    }

    // Banner image validation
    if (profileData.bannerImage) {
      const bannerValidation = validateBase64Image(
        profileData.bannerImage,
        "Banner image"
      );
      if (!bannerValidation.isValid) {
        newErrors.bannerImage = bannerValidation.errors[0];
      }
    }

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: Object.values(newErrors).filter((error): error is string => error !== null),
    };
  }, []);

  const clearError = useCallback((fieldName: string): void => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: null,
    }));
  }, []);

  const clearAllErrors = useCallback((): void => {
    setErrors({});
  }, []);

  return {
    errors,
    validateImage,
    validateProfileImages,
    clearError,
    clearAllErrors,
  };
}
