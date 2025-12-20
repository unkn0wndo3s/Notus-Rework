import { PrismaDocumentRepository } from "../repositories/PrismaDocumentRepository";
import { CreateDocumentData, Document, DocumentRepositoryResult, TrashDocument } from "../types";

export class PrismaDocumentService {
  private documentRepository: PrismaDocumentRepository;

  constructor() {
    this.documentRepository = new PrismaDocumentRepository();
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

  async getDocumentById(id: number): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.getDocumentById(id);
    } catch (error) {
      console.error("❌ Error retrieving document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.getUserDocuments(userId, limit, offset);
    } catch (error) {
      console.error("❌ Error retrieving user documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async updateDocument(id: number, userId: number, title: string, content: string, tags: string[]): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.updateDocument(id, userId, title, content, tags);
    } catch (error) {
      console.error("❌ Error updating document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async deleteDocument(id: number, userId: number): Promise<DocumentRepositoryResult<boolean>> {
    try {
      return await this.documentRepository.deleteDocument(id, userId);
    } catch (error) {
      console.error("❌ Error deleting document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async deleteDocumentsBulk(userId: number, documentIds: string[]): Promise<DocumentRepositoryResult<{ deletedCount: number }>> {
    try {
      return await this.documentRepository.deleteDocumentsBulk(userId, documentIds);
    } catch (error) {
      console.error("❌ Error deleting multiple documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async createOrUpdateDocumentById(id: number, userId: number, userEmail: string, title: string, content: string, tags: string[]): Promise<DocumentRepositoryResult<Document>> {
    try {
      return await this.documentRepository.createOrUpdateDocumentById(id, userId, title, content, tags, userEmail);
    } catch (error) {
      console.error("❌ Error creating/updating document:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getUserTrashedDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<DocumentRepositoryResult<TrashDocument[]>> {
    try {
      return await this.documentRepository.getUserTrashedDocuments(userId, limit, offset) as any;
    } catch (error) {
      console.error("❌ Error retrieving trash:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" } as any;
    }
  }

  async restoreDocumentFromTrash(trashId: number, userId: number): Promise<DocumentRepositoryResult<{ id: number }>> {
    try {
      return await this.documentRepository.restoreDocumentFromTrash(trashId, userId);
    } catch (error) {
      console.error("❌ Error restoring from trash:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async fetchSharedWithUser(email: string): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.fetchSharedWithUser(email);
    } catch (error) {
      console.error("❌ Error retrieving shared documents:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error", documents: [] };
    }
  }

  async fetchSharedByUser(userId: number): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      return await this.documentRepository.fetchSharedByUser(userId);
    } catch (error) {
      console.error("❌ Error retrieving documents shared by user:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error", documents: [] };
    }
  }

  async toggleFavoriteForDocument(documentId: number, userId: number, value: boolean | null) {
    try {
      return await this.documentRepository.toggleFavoriteForDocument(documentId, userId, value);
    } catch (error) {
      console.error("❌ Error toggling favorite (document):", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async toggleFavoriteForShare(documentId: number, email: string, value: boolean | null) {
    try {
      return await this.documentRepository.toggleFavoriteForShare(documentId, email, value);
    } catch (error) {
      console.error("❌ Error toggling favorite (share):", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async getFavorites(userId: number, email: string) {
    try {
      return await this.documentRepository.getFavorites(userId, email);
    } catch (error) {
      console.error("❌ Error retrieving favorites:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error", documents: [] };
    }
  }
}
