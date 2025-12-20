import { DocumentRepository } from "../repositories/DocumentRepository";
import { CreateDocumentData, UpdateDocumentData, Document, DocumentRepositoryResult } from "../types";

export class DocumentService {
  private documentRepository: DocumentRepository;

  constructor() {
    this.documentRepository = new DocumentRepository();
  }

  async initializeTables(): Promise<void> {
    await this.documentRepository.initializeTables();
  }

  async createDocument(data: CreateDocumentData): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.createDocument(data);
    } catch (error) {
      console.error("❌ Error creating document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.getUserDocuments(userId, limit, offset);
    } catch (error) {
      console.error("❌ Error retrieving documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getDocumentById(documentId: number): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.getDocumentById(documentId);
    } catch (error) {
      console.error("❌ Error retrieving document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async updateDocument(data: UpdateDocumentData): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.updateDocument(data);
    } catch (error) {
      console.error("❌ Error updating document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async createOrUpdateDocumentById(
    documentId: number | null,
    userId: number,
    userEmail: string,
    title: string,
    content: string,
    tags: string[] | undefined = undefined
  ): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.createOrUpdateDocumentById(documentId, userId, title, content, tags, userEmail);
    } catch (error) {
      console.error("❌ Error creating/updating document by ID:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async deleteDocument(documentId: number, userId: number): Promise<DocumentRepositoryResult<{ id: number }>> {
    try {
      return await this.documentRepository.deleteDocument(documentId, userId);
    } catch (error) {
      console.error("❌ Error deleting document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async deleteDocumentsBulk(userId: number, documentIds: (string | number)[]): Promise<DocumentRepositoryResult<{ deletedIds: number[]; deletedCount: number }>> {
    try {
      return await this.documentRepository.deleteDocumentsBulk(userId, documentIds);
    } catch (error) {
      console.error("❌ Error deleting multiple documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  // Share-related wrappers
  async fetchSharedWithUser(email: string): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.fetchSharedWithUser(email);
    } catch (error) {
      console.error("❌ Error retrieving shared documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async fetchSharedByUser(userId: number): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.fetchSharedByUser(userId);
    } catch (error) {
      console.error("❌ Error retrieving documents shared by user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getSharePermission(documentId: number, email: string): Promise<DocumentRepositoryResult<{ permission: boolean }>> {
    try {
      return await this.documentRepository.getSharePermission(documentId, email);
    } catch (error) {
      console.error("❌ Error retrieving share permission:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async addShare(documentId: number, email: string, permission: boolean): Promise<DocumentRepositoryResult<{ id: number }>> {
    try {
      return await this.documentRepository.addShare(documentId, email, permission);
    } catch (error) {
      console.error("❌ Error adding share:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async fetchDocumentAccessList(documentId: number): Promise<DocumentRepositoryResult<{ accessList: any[] }>> {
    try {
      return await this.documentRepository.getAccessList(documentId);
    } catch (error) {
      console.error('❌ Error retrieving access list:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async updatePermission(documentId: number, userId: number, permission: boolean): Promise<DocumentRepositoryResult<{ updatedCount: number }>> {
    try {
      return await this.documentRepository.updatePermission(documentId, userId, permission);
    } catch (error) {
      console.error('❌ Error updating share permission:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async findShare(documentId: number, userId: number): Promise<DocumentRepositoryResult<{ share: any }>> {
    try {
      return await this.documentRepository.findShare(documentId, userId);
    } catch (error) {
      console.error('❌ Error finding share:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async removeShare(documentId: number, email: string): Promise<DocumentRepositoryResult<{ deletedCount: number }>> {
    try {
      return await this.documentRepository.removeShare(documentId, email);
    } catch (error) {
      console.error('❌ Error removing share:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async ownerIdForDocument(documentId: number): Promise<DocumentRepositoryResult<{ ownerId: number | null }>> {
    try {
      return await this.documentRepository.ownerIdForDocument(documentId);
    } catch (error) {
      console.error('❌ Error retrieving ownerId for document:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Utility methods for data validation
  validateDocumentTitle(title: string): { isValid: boolean; error?: string } {
    if (!title || title.trim().length === 0) {
      return { isValid: false, error: "Document title cannot be empty" };
    }

    if (title.length > 255) {
      return { isValid: false, error: "Title cannot exceed 255 characters" };
    }

    return { isValid: true };
  }


  validateDocumentTags(tags: string[]): { isValid: boolean; error?: string } {
    if (!Array.isArray(tags)) {
      return { isValid: false, error: "Tags must be an array" };
    }

    if (tags.length > 20) {
      return { isValid: false, error: "You cannot have more than 20 tags" };
    }

    for (const tag of tags) {
      if (typeof tag !== 'string') {
        return { isValid: false, error: "All tags must be strings" };
      }

      if (tag.length > 50) {
        return { isValid: false, error: "Each tag cannot exceed 50 characters" };
      }

      if (tag.trim().length === 0) {
        return { isValid: false, error: "Tags cannot be empty" };
      }
    }

    return { isValid: true };
  }

  async userHasAccessToDocument(documentId: number, userId?: number, email?: string): Promise<boolean> {
    if (!documentId || documentId <= 0) {
      return false;
    }

    if (!userId && !email) {
      return false;
    }

    try {
      await this.initializeTables();
      const documentResult = await this.getDocumentById(documentId);
      if (!documentResult.success || !documentResult.document) {
        return false;
      }

      const docUserIdRaw = documentResult.document.user_id;
      const docUserId = typeof docUserIdRaw === "number" ? docUserIdRaw : Number(docUserIdRaw);
      
      // Check if user is owner (strict comparison)
      if (userId && Number.isFinite(userId) && Number.isFinite(docUserId)) {
        if (docUserId === userId) {
          return true;
        }
      }

      // Check if user has a share (read only or edit)
      // Always check email if available, even if userId doesn't match
      if (email && typeof email === "string" && email.trim().length > 0) {
        const normalizedEmail = email.trim().toLowerCase();
        const shareResult = await this.getSharePermission(documentId, normalizedEmail);
        // If a share exists (even read only), user has access
        // shareResult.success === true means a share was found in the database
        // Explicitly check that data exists and is not null
        if (shareResult.success === true && shareResult.data && shareResult.data !== null) {
          return true;
        }
      }

      // If we get here, user is neither owner nor shared
      return false;
    } catch (error) {
      console.error("❌ Error userHasAccessToDocument:", error);
      return false;
    }
  }

  validateDocumentData(data: { title: string; content: string; tags: string[] }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const titleValidation = this.validateDocumentTitle(data.title);
    if (!titleValidation.isValid) {
      errors.push(titleValidation.error!);
    }

    const tagsValidation = this.validateDocumentTags(data.tags);
    if (!tagsValidation.isValid) {
      errors.push(tagsValidation.error!);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
