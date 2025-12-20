import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { DocumentService as BaseDocumentService } from "../../services/DocumentService";
import { DocumentValidator } from "../../validators/DocumentValidator";
import { ActionResult } from "../../types";

export class DocumentManagementService {
  private readonly documentService: BaseDocumentService;

  constructor() {
    this.documentService = new BaseDocumentService();
  }

  private getStringFromFormData(fd: FormData, key: string, defaultValue: string = ""): string {
    const val = fd.get(key);
    return typeof val === "string" ? val : defaultValue;
  }

  private getUserId(userIdRaw: string | null | undefined): { userId: number; error?: string } {
    if (!userIdRaw || userIdRaw === "undefined" || userIdRaw === "null" || userIdRaw === "unknown") {
      console.error("❌ User ID not defined in session");
      return { userId: 0, error: "Invalid user session. Please log in again." };
    }

    if (userIdRaw === "oauth-simulated-user") {
      return { userId: 1 };
    }

    const userId = Number(userIdRaw);
    if (Number.isNaN(userId) || userId <= 0) {
      console.error("❌ Invalid user ID:", userIdRaw, "Parsed as:", userId);
      return { userId: 0, error: "Invalid user ID. Please log in again." };
    }

    return { userId };
  }

  async createDocument(_prevState: unknown, formData: FormData): Promise<ActionResult | string> {
    try {
      const title = this.getStringFromFormData(formData, "title");
      const content = this.getStringFromFormData(formData, "content");
      const userIdRaw = formData.get("userId") as string;
      const rawTags = formData.get("tags");

      const { userId, error } = this.getUserId(userIdRaw);
      if (error) return error;

      let tags: string[] = [];
      try {
        if (rawTags && typeof rawTags === "string") {
          tags = JSON.parse(rawTags);
        } else if (Array.isArray(rawTags)) {
          tags = rawTags;
        }
      } catch (e) {
        console.warn("Failed to parse tags payload", e);
      }

      const validation = DocumentValidator.validateDocumentData({
        title: title || "",
        content: content || "",
        tags,
      });

      if (!validation.isValid) {
        return Object.values(validation.errors)[0] || "Invalid data";
      }

      if (!process.env.DATABASE_URL) {
        return "Document created successfully (simulation mode). Configure DATABASE_URL for persistence.";
      }

      await this.documentService.initializeTables();

      const result = await this.documentService.createDocument({
        userId,
        title: title.trim(),
        content: content || "",
        tags,
      });

      if (!result.success) {
        console.error("❌ Document creation error:", result.error);
        return "Error while creating document. Please try again.";
      }

      return {
        success: true,
        message: "Document created successfully!",
        documentId: result.document!.id,
      };
    } catch (error: unknown) {
      console.error("❌ Error while creating document:", error);
      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }
      return "Error while creating document. Please try again.";
    }
  }

  async getUserDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<ActionResult> {
    try {
      const paginationValidation = DocumentValidator.validatePaginationParams(limit, offset);
      if (!paginationValidation.isValid) {
        return {
          success: false,
          error: Object.values(paginationValidation.errors)[0] || "Invalid pagination parameters",
          documents: [],
        };
      }

      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          documents: [
            {
              id: 1,
              user_id: 1,
              title: "Simulation Document",
              content: "Configure DATABASE_URL for persistence.",
              tags: [],
              created_at: new Date(),
              updated_at: new Date(),
              username: "simulation",
              first_name: "Test",
              last_name: "User",
            },
          ],
        };
      }

      await this.documentService.initializeTables();

      const result = await this.documentService.getUserDocuments(userId, limit, offset);

      if (!result.success) {
        console.error("❌ Error retrieving documents:", result.error);
        return {
          success: false,
          error: "Error while retrieving documents.",
          documents: [],
        };
      }

      return {
        success: true,
        documents: result.documents || [],
      };
    } catch (error: unknown) {
      console.error("❌ Error while retrieving documents:", error);
      return {
        success: false,
        error: "Error while retrieving documents.",
        documents: [],
      };
    }
  }

  async getDocumentById(documentId: number): Promise<ActionResult> {
    try {
      const idValidation = DocumentValidator.validateDocumentId(documentId);
      if (!idValidation.isValid) {
        return {
          success: false,
          error: Object.values(idValidation.errors)[0] || "Invalid document ID",
          document: undefined,
        };
      }

      if (!process.env.DATABASE_URL) {
        return {
          success: true,
          document: {
            id: Number(documentId.toString()),
            user_id: 1,
            title: "Simulation Document",
            content: "Configure DATABASE_URL for persistence.",
            tags: [],
            created_at: new Date(),
            updated_at: new Date(),
            username: "simulation",
            first_name: "Test",
            last_name: "User",
          },
        };
      }

      await this.documentService.initializeTables();

      const result = await this.documentService.getDocumentById(Number(documentId.toString()));

      if (!result.success) {
        console.error("❌ Error retrieving document:", result.error);
        return {
          success: false,
          error: "Error while retrieving document.",
          document: undefined,
        };
      }

      return {
        success: true,
        document: result.document,
      };
    } catch (error: unknown) {
      console.error("❌ Error while retrieving document:", error);
      return {
        success: false,
        error: "Error while retrieving document.",
        document: undefined,
      };
    }
  }

  private async getTagsFromRaw(rawTags: any): Promise<string[]> {
    let tags: string[] = [];
    try {
      if (rawTags && typeof rawTags === "string") tags = JSON.parse(rawTags);
      else if (Array.isArray(rawTags)) tags = rawTags;
    } catch {}
    return tags;
  }

  private async getUserEmail(fd: FormData | null, formDataOrObj: any): Promise<string | undefined> {
    let userEmail: string | undefined;
    if (fd) {
      const email = fd.get("email");
      if (typeof email === "string") userEmail = email;
    } else {
      userEmail = formDataOrObj.email;
    }

    if (!userEmail) {
      try {
        const session = await getServerSession(authOptions);
        userEmail = session?.user?.email || undefined;
      } catch {}
    }
    return userEmail;
  }

  private getFormDataValue(fd: FormData | null, obj: any, key: string): any {
    return fd ? fd.get(key) : obj[key];
  }

  private async getUpdateUserId(fd: FormData | null, formDataOrObj: any): Promise<number | undefined> {
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) return Number(session.user.id);
    } catch {}

    const u = this.getFormDataValue(fd, formDataOrObj, "userId");
    return typeof u === "string" || typeof u === "number" ? Number(u) : undefined;
  }

  private emptyUpdateContext() {
    return { documentId: 0, userId: 0, title: "", content: "", tags: [] };
  }

  private validateDocumentIdInContext(fd: FormData | null, formDataOrObj: any): { documentId?: number; error?: string } {
    const raw = this.getFormDataValue(fd, formDataOrObj, "documentId");
    const str = typeof raw === "string" ? raw : String(raw ?? "");
    if (!str) return { error: "Missing documentId" };

    const val = DocumentValidator.validateDocumentId(str);
    if (!val.isValid) return { error: Object.values(val.errors)[0] || "Invalid document ID" };
    return { documentId: Number(str) };
  }

  private async getUpdateContext(formDataOrObj: any): Promise<{
    documentId: number;
    userId: number;
    userEmail?: string;
    title: string;
    content: string;
    tags: string[];
    error?: string;
  }> {
    const fd = formDataOrObj instanceof FormData ? formDataOrObj : null;
    
    const resId = this.validateDocumentIdInContext(fd, formDataOrObj);
    if (resId.error) return { ...this.emptyUpdateContext(), error: resId.error };

    const userId = await this.getUpdateUserId(fd, formDataOrObj);
    if (!userId) return { ...this.emptyUpdateContext(), error: "Not authenticated" };

    const title = fd ? this.getStringFromFormData(fd, "title") : (formDataOrObj.title ?? "");
    const content = fd ? this.getStringFromFormData(fd, "content") : (formDataOrObj.content ?? "");
    const tags = await this.getTagsFromRaw(this.getFormDataValue(fd, formDataOrObj, "tags"));
    const userEmail = await this.getUserEmail(fd, formDataOrObj);

    const validation = DocumentValidator.validateDocumentData({ title, content, tags });
    if (!validation.isValid) return { ...this.emptyUpdateContext(), error: Object.values(validation.errors)[0] || "Invalid data" };

    return { documentId: resId.documentId!, userId, userEmail, title, content, tags };
  }

  async updateDocument(_prevState: unknown, formDataOrObj: any): Promise<ActionResult> {
    try {
      if (!formDataOrObj) return { ok: false, error: "No data provided" };

      const context = await this.getUpdateContext(formDataOrObj);
      if (context.error) return { ok: false, error: context.error };

      const updateResult = await this.documentService.createOrUpdateDocumentById(
        context.documentId,
        context.userId,
        context.userEmail || "",
        context.title,
        context.content,
        context.tags
      );

      if (!updateResult.success) {
        console.error("❌ Document update error:", updateResult.error);
        return { ok: false, error: updateResult.error || "Error while updating the document." };
      }

      return { ok: true, id: context.documentId, dbResult: updateResult };
    } catch (err: unknown) {
      console.error(err);
      return { ok: false, error: String(err instanceof Error ? err.message : err) };
    }
  }

  async deleteDocument(_prevState: unknown, formData: FormData): Promise<string> {
    try {
      const documentId = this.getStringFromFormData(formData, "documentId");
      const userIdRaw = this.getStringFromFormData(formData, "userId");

      if (!documentId || !userIdRaw) return "Document ID and user required.";

      const documentIdValidation = DocumentValidator.validateDocumentId(documentId);
      if (!documentIdValidation.isValid) return Object.values(documentIdValidation.errors)[0] || "Invalid document ID";

      const userIdValidation = DocumentValidator.validateUserId(userIdRaw);
      if (!userIdValidation.isValid) return Object.values(userIdValidation.errors)[0] || "Invalid user ID";

      const documentIdNumber = Number(documentId);
      const userIdNumber = Number(userIdRaw);

      if (!process.env.DATABASE_URL) return "Document deleted successfully (simulation mode). Configure DATABASE_URL for persistence.";

      await this.documentService.initializeTables();

      const result = await this.documentService.deleteDocument(documentIdNumber, userIdNumber);

      if (!result.success) {
        console.error("❌ Document deletion error:", result.error);
        return result.error!;
      }

      return "Document deleted successfully";
    } catch (error: unknown) {
      console.error("❌ Error during document deletion:", error);
      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }
      return "Error while deleting document. Please try again.";
    }
  }

  async deleteMultipleDocuments(_prevState: unknown, formData: FormData): Promise<string> {
    try {
      const userIdRaw = this.getStringFromFormData(formData, "userId");
      const idsRaw = formData.getAll("documentIds") as string[];

      if (!userIdRaw) return "User ID required.";

      const userIdValidation = DocumentValidator.validateUserId(userIdRaw);
      if (!userIdValidation.isValid) return Object.values(userIdValidation.errors)[0] || "Invalid user ID";

      const documentIdsValidation = DocumentValidator.validateDocumentIds(idsRaw);
      if (!documentIdsValidation.isValid) return Object.values(documentIdsValidation.errors)[0] || "Invalid document IDs";

      const userIdNumber = Number(userIdRaw);

      if (!process.env.DATABASE_URL) return `${idsRaw.length} document(s) deleted (simulation mode). Configure DATABASE_URL for persistence.`;

      await this.documentService.initializeTables();

      const result = await this.documentService.deleteDocumentsBulk(userIdNumber, idsRaw);

      if (!result.success) return result.error || "Error during multiple deletion.";

      return `${result.data?.deletedCount || 0} document(s) successfully deleted`;
    } catch (error: unknown) {
      console.error("❌ Error during multiple deletion:", error);
      if (error && typeof error === 'object' && 'code' in error && 
          (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
        return "Database not accessible. Check PostgreSQL configuration.";
      }
      return "Error during multiple deletion. Please try again.";
    }
  }
}


