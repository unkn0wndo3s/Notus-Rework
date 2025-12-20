import { ValidationResult } from "../types";

export class DocumentValidator {
  static validateTitle(title: string): ValidationResult {
    const errors: Record<string, string> = {};

    if (!title || title.trim().length === 0) {
      errors.title = "Document title is required";
      return { isValid: false, errors };
    }

    if (title.length > 255) {
      errors.title = "Title cannot exceed 255 characters";
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validateTags(tags: string[]): ValidationResult {
    const errors: Record<string, string> = {};

    if (!Array.isArray(tags)) {
      errors.tags = "Tags must be an array";
      return { isValid: false, errors };
    }

    if (tags.length > 20) {
      errors.tags = "You cannot have more than 20 tags";
      return { isValid: false, errors };
    }

    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      
      if (typeof tag !== 'string') {
        errors.tags = `Tag at index ${i} must be a string`;
        return { isValid: false, errors };
      }

      if (tag.trim().length === 0) {
        errors.tags = `Tag at index ${i} cannot be empty`;
        return { isValid: false, errors };
      }

      if (tag.length > 50) {
        errors.tags = `Tag at index ${i} cannot exceed 50 characters`;
        return { isValid: false, errors };
      }

      // Check that tag only contains authorized characters
      const tagRegex = /^[a-zA-Z0-9À-ÿ\s_-]+$/;
      if (!tagRegex.test(tag)) {
        errors.tags = `Tag at index ${i} contains unauthorized characters`;
        return { isValid: false, errors };
      }
    }

    return { isValid: true, errors: {} };
  }

  static validateDocumentData(data: {
    title: string;
    content: string;
    tags: string[];
  }): ValidationResult {
    const errors: Record<string, string> = {};

    // Validate title
    const titleValidation = this.validateTitle(data.title);
    if (!titleValidation.isValid) {
      Object.assign(errors, titleValidation.errors);
    }

    // Validate tags
    const tagsValidation = this.validateTags(data.tags);
    if (!tagsValidation.isValid) {
      Object.assign(errors, tagsValidation.errors);
    }

    // Validate file attachments in content
    const fileValidation = this.validateFileAttachments(data.content);
    if (!fileValidation.isValid) {
      Object.assign(errors, fileValidation.errors);
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateDocumentId(documentId: string | number): ValidationResult {
    const errors: Record<string, string> = {};

    const id = typeof documentId === 'string' ? Number(documentId) : documentId;

    if (Number.isNaN(id) || id <= 0) {
      errors.documentId = "Document ID must be a valid positive number";
      return { isValid: false, errors };
    }

    return { isValid: true, errors: {} };
  }

  static validateUserId(userId: string | number): ValidationResult {
    const errors: Record<string, string> = {};

    const id = typeof userId === 'string' ? Number(userId) : userId;

    if (Number.isNaN(id) || id <= 0) {
      errors.userId = "User ID must be a valid positive number";
      return { isValid: false, errors };
    }

    return { isValid: true, errors };
  }

  static validateDocumentIds(documentIds: (string | number)[]): ValidationResult {
    const errors: Record<string, string> = {};

    if (!Array.isArray(documentIds)) {
      errors.documentIds = "Document IDs must be an array";
      return { isValid: false, errors };
    }

    if (documentIds.length === 0) {
      errors.documentIds = "No document selected";
      return { isValid: false, errors };
    }

    if (documentIds.length > 100) {
      errors.documentIds = "You cannot select more than 100 documents at once";
      return { isValid: false, errors };
    }

    for (let i = 0; i < documentIds.length; i++) {
      const id = Number(String(documentIds[i]));
      
      if (Number.isNaN(id) || id <= 0) {
        errors.documentIds = `Document ID at index ${i} is not valid`;
        return { isValid: false, errors };
      }
    }

    return { isValid: true, errors: {} };
  }

  static validatePaginationParams(limit?: number, offset?: number): ValidationResult {
    const errors: Record<string, string> = {};

    if (limit !== undefined) {
      if (!Number.isInteger(limit) || limit < 1) {
        errors.limit = "Limit must be a positive integer";
      } else if (limit > 100) {
        errors.limit = "Limit cannot exceed 100";
      }
    }

    if (offset !== undefined) {
      if (!Number.isInteger(offset) || offset < 0) {
        errors.offset = "Offset must be a positive integer or zero";
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  static validateFileAttachments(_content: string): ValidationResult {
    // Files are now stored in a separate table
    // Size validation is done during upload
    // We just check that references are valid (optional)
    return {
      isValid: true,
      errors: {}
    };
  }
}

