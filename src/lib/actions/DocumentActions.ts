"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { DocumentService } from "../services/DocumentService";
import { DocumentValidator } from "../validators/DocumentValidator";
import { ActionResult } from "../types";
import { recordDocumentHistoryImmediate } from "../documentHistory";

const documentService = new DocumentService();

export async function createDocumentAction(prevState: unknown, formData: FormData): Promise<ActionResult | string> {
  try {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const userId = formData.get("userId") as string;
    const rawTags = formData.get("tags") as string;

    if (!userId) {
      return "User required.";
    }

    // Handle different types of user IDs
    let userIdNumber: number;

    // If user ID is undefined or null
    if (
      !userId ||
      userId === "undefined" ||
      userId === "null" ||
      userId === "unknown"
    ) {
      console.error("❌ User ID not defined in session");
      return "Invalid user session. Please log in again.";
    }

    // If it's a simulated OAuth ID
    if (userId === "oauth-simulated-user") {
      userIdNumber = 1; // Simulation ID
    } else {
      // Verify that user ID is a valid number
      userIdNumber = parseInt(userId);
      if (isNaN(userIdNumber) || userIdNumber <= 0) {
        console.error(
          "❌ Invalid User ID:",
          userId,
          "Parsed as:",
          userIdNumber
        );
        return "Invalid user ID. Please log in again.";
      }
    }

    // Parse tags
    let tags: string[] = [];
    try {
      if (rawTags) {
        tags = typeof rawTags === "string" ? JSON.parse(rawTags) : rawTags;
      }
    } catch (e) {
      console.warn("Failed to parse tags payload", e);
      tags = [];
    }

    // Data validation
    const validation = DocumentValidator.validateDocumentData({
      title: title || "",
      content: content || "",
      tags,
    });

    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Document created successfully (simulation mode). Configure DATABASE_URL for persistence.";
    }

    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Create new document
    const result = await documentService.createDocument({
      userId: userIdNumber,
      title: title.trim(),
      content: content || "",
      tags,
    });

    if (!result.success) {
      console.error("❌ Error creating document:", result.error);
      return "Error creating document. Please try again.";
    }

    return {
      success: true,
      message: "Document created successfully!",
      documentId: result.document!.id,
    };
  } catch (error: unknown) {
    console.error("❌ Error creating document:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error creating document. Please try again.";
  }
}

export async function getUserDocumentsAction(userId: number, limit: number = 20, offset: number = 0): Promise<ActionResult> {
  try {
    // Pagination parameters validation
    const paginationValidation = DocumentValidator.validatePaginationParams(limit, offset);
    if (!paginationValidation.isValid) {
      return {
        success: false,
        error: Object.values(paginationValidation.errors)[0] || "Invalid pagination parameters",
        documents: [],
      };
    }

    // Check if database is configured
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
            sharedWith: [],
            folderIds: [],
            shared: false,
          },
        ],
      };
    }

    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Retrieve documents
    const result = await documentService.getUserDocuments(userId, limit, offset);

    if (!result.success) {
      console.error("❌ Error retrieving documents:", result.error);
      return {
        success: false,
        error: "Error retrieving documents.",
        documents: [],
      };
    }

    return {
      success: true,
      documents: result.documents || [],
    };
  } catch (error: unknown) {
    console.error("❌ Error retrieving documents:", error);
    return {
      success: false,
      error: "Error retrieving documents.",
      documents: [],
    };
  }
}

export async function getDocumentByIdAction(documentId: number): Promise<ActionResult> {
  try {
    // Document ID validation
    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return {
        success: false,
        error: Object.values(idValidation.errors)[0] || "Invalid document ID",
        document: undefined,
      };
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return {
        success: true,
        document: {
          id: parseInt(documentId.toString()),
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

    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Retrieve document
    const result = await documentService.getDocumentById(parseInt(documentId.toString()));

    if (!result.success) {
      console.error("❌ Error retrieving document:", result.error);
      return {
        success: false,
        error: "Error retrieving document.",
        document: undefined,
      };
    }

    return {
      success: true,
      document: result.document,
    };
  } catch (error: unknown) {
    console.error("❌ Error retrieving document:", error);
    return {
      success: false,
      error: "Error retrieving document.",
      document: undefined,
    };
  }
}

interface UpdateDocumentPayload {
  documentId?: string | number;
  userId?: string | number;
  title?: string;
  content?: string;
  tags?: string | string[];
  email?: string;
}

export async function updateDocumentAction(prevState: unknown, formDataOrObj: FormData | UpdateDocumentPayload): Promise<ActionResult> {
  try {
    // Verify that formDataOrObj exists and is valid
    if (!formDataOrObj) {
      return { ok: false, error: "No data provided" };
    }

    const fd = formDataOrObj instanceof FormData ? formDataOrObj : null;
    const documentId = fd
      ? String(fd.get("documentId") || "")
      : String((formDataOrObj as UpdateDocumentPayload).documentId || "");
    
    if (!documentId) return { ok: false, error: "Missing documentId" };

    // Document ID validation
    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return { ok: false, error: Object.values(idValidation.errors)[0] || "Invalid document ID" };
    }

    // Try server session (if available)
    let serverUserId: number | undefined;
    try {
      const session = await getServerSession(authOptions);
      serverUserId = session?.user?.id ? Number(session.user.id) : undefined;
    } catch (e: unknown) {
      console.warn("getServerSession failed at runtime, falling back to client userId", e instanceof Error ? e.message : e);
    }

    // If no server session, try client-sent userId
    let clientUserId: number | undefined;
    if (fd) {
      const u = fd.get("userId");
      if (u) clientUserId = Number(String(u));
    } else if ((formDataOrObj as UpdateDocumentPayload).userId) {
      clientUserId = Number((formDataOrObj as UpdateDocumentPayload).userId);
    }

    const userIdToUse = serverUserId ?? clientUserId;

    if (!userIdToUse) {
      return { ok: false, error: "Not authenticated" };
    }

    const idNum = Number(documentId);

    // Parse title/content/tags
    let title = "";
    let contentStr = "";
    let rawTags: unknown = null;
    
    if (fd) {
      title = String(fd.get("title") || "");
      contentStr = String(fd.get("content") || "");
      rawTags = fd.get("tags") || null;
    } else {
      const obj = formDataOrObj as UpdateDocumentPayload;
      title = obj.title || "";
      contentStr = obj.content || "";
      rawTags = obj.tags || null;
    }

    let tags: string[] = [];

    try {
      if (rawTags) {
        tags = typeof rawTags === "string" ? JSON.parse(rawTags) : rawTags;
      }
    } catch (e) {
      console.warn("Failed to parse tags payload", e);
      tags = [];
    }

    // Data validation
    const validation = DocumentValidator.validateDocumentData({
      title,
      content: contentStr,
      tags,
    });

    if (!validation.isValid) {
      return { ok: false, error: Object.values(validation.errors)[0] || "Invalid data" };
    }

    // Actually update the document in the database
    // Get user email from session or formData
    let userEmail: string | undefined = undefined;
    if (fd && fd.get("email")) {
      userEmail = String(fd.get("email"));
    } else if (typeof (formDataOrObj as UpdateDocumentPayload).email === "string") {
      userEmail = (formDataOrObj as UpdateDocumentPayload).email;
    } else {
      // Try to get from server session
      try {
        const session = await getServerSession(authOptions);
        userEmail = session?.user?.email || undefined;
      } catch {}
    }
    if (!userEmail) {
      return { ok: false, error: "Missing user email for update." };
    }

    // Retrieve previous content to record readable history
    let previousContent: string | null = null;
    try {
      const existing = await documentService.getDocumentById(idNum);
      if (existing.success && existing.document) {
        previousContent = existing.document.content;
      }
    } catch {
      previousContent = null;
    }

    // Record history immediately for explicit HTTP saves
    await recordDocumentHistoryImmediate({
      documentId: idNum,
      userId: userIdToUse,
      userEmail,
      previousContent,
      nextContent: contentStr,
    });

    const updateResult = await documentService.createOrUpdateDocumentById(
      idNum,
      userIdToUse,
      userEmail,
      title,
      contentStr,
      tags
    );

    if (!updateResult.success) {
      console.error("❌ Error updating document:", updateResult.error);
      return {
        ok: false,
        error: updateResult.error || "Error updating document.",
      };
    }

    return {
      ok: true,
      id: idNum,
      dbResult: updateResult,
    };
  } catch (err: unknown) {
    console.error(err);
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function deleteDocumentAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const documentId = formData.get("documentId") as string;
    const userId = formData.get("userId") as string;

    if (!documentId || !userId) {
      return "Document and User ID required.";
    }

    // IDs Validation
    const documentIdValidation = DocumentValidator.validateDocumentId(documentId);
    if (!documentIdValidation.isValid) {
      return Object.values(documentIdValidation.errors)[0] || "Invalid document ID";
    }

    const userIdValidation = DocumentValidator.validateUserId(userId);
    if (!userIdValidation.isValid) {
      return Object.values(userIdValidation.errors)[0] || "Invalid user ID";
    }

    const documentIdNumber = parseInt(documentId);
    const userIdNumber = parseInt(userId);

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Document deleted successfully (simulation mode). Configure DATABASE_URL for persistence.";
    }

    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Delete document
    const result = await documentService.deleteDocument(documentIdNumber, userIdNumber);

    if (!result.success) {
      console.error("❌ Error deleting document:", result.error);
      return result.error!;
    }

    return "Document deleted successfully";
  } catch (error: unknown) {
    console.error("❌ Error deleting document:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error deleting document. Please try again.";
  }
}

export async function deleteMultipleDocumentsAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const userId = formData.get("userId") as string;
    const idsRaw = formData.getAll("documentIds") as string[];

    if (!userId) {
      return "User ID required.";
    }

    // User ID Validation
    const userIdValidation = DocumentValidator.validateUserId(userId);
    if (!userIdValidation.isValid) {
      return Object.values(userIdValidation.errors)[0] || "Invalid user ID";
    }

    // Document IDs Validation
    const documentIdsValidation = DocumentValidator.validateDocumentIds(idsRaw);
    if (!documentIdsValidation.isValid) {
      return Object.values(documentIdsValidation.errors)[0] || "Invalid document IDs";
    }

    const userIdNumber = parseInt(userId);

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return `${idsRaw.length} document(s) deleted (simulation mode). Configure DATABASE_URL for persistence.`;
    }

    await documentService.initializeTables();

    const result = await documentService.deleteDocumentsBulk(userIdNumber, idsRaw);

    if (!result.success) {
      return result.error || "Error during bulk deletion.";
    }

    return `${result.data?.deletedCount || 0} document(s) deleted successfully`;
  } catch (error: unknown) {
    console.error("❌ Error during bulk deletion:", error);
    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }
    return "Error during bulk deletion. Please try again.";
  }
}

// --- Share-related server actions ---
export async function fetchSharedDocumentsAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email as string | undefined;
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    if (!email || !userId) {
      return { success: false, error: "User not authenticated", documents: [] };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, documents: [] };
    }

    await documentService.initializeTables();

    // Retrieve documents shared with user
    const sharedWithResult = await documentService.fetchSharedWithUser(email);
    if (!sharedWithResult.success) {
      return { success: false, error: sharedWithResult.error || "Error retrieving shared documents", documents: [] };
    }

    // Retrieve documents shared by user
    const sharedByResult = await documentService.fetchSharedByUser(userId);
    if (!sharedByResult.success) {
      return { success: false, error: sharedByResult.error || "Error retrieving shared documents", documents: [] };
    }

    // Combine both lists
    const allSharedDocuments = [
      ...(sharedWithResult.documents || []),
      ...(sharedByResult.documents || [])
    ];

    return { success: true, documents: allSharedDocuments };
  } catch (error: unknown) {
    console.error("❌ Error fetchSharedDocumentsAction:", error);
    return { success: false, error: "Error retrieving shared documents", documents: [] };
  }
}

export async function getSharePermissionAction(documentId: number): Promise<ActionResult> {
  try {
    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return { success: false, error: Object.values(idValidation.errors)[0] || "Invalid document ID" };
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email as string | undefined;

    if (!email) {
      return { success: false, error: "User not authenticated" };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, data: { permission: false } } as ActionResult;
    }

    await documentService.initializeTables();

    const result = await documentService.getSharePermission(documentId, email);
    if (!result.success) {
      return { success: false, error: result.error || "Permission not found" };
    }

    return { success: true, dbResult: { success: true, error: undefined, document: undefined }, data: result.data } as ActionResult;
  } catch (error: unknown) {
    console.error("❌ Error getSharePermissionAction:", error);
    return { success: false, error: "Error retrieving permission" };
  }
}

export async function addShareAction(prevState: unknown, formData: FormData): Promise<ActionResult | string> {
  try {
    const documentIdRaw = formData.get("documentId") as string | null;
    const targetEmail = formData.get("email") as string | null;
    const permissionRaw = formData.get("permission") as string | null;

    if (!documentIdRaw || !targetEmail || permissionRaw === null) {
      return { success: false, error: "documentId, email and permission are required" };
    }

    const documentId = parseInt(documentIdRaw, 10);
    const permission = permissionRaw === "true" || permissionRaw === "1";

    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return { success: false, error: Object.values(idValidation.errors)[0] || "Invalid document ID" };
    }

    // Auth check and ownership/admin verification
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const userEmail = session?.user?.email as string | undefined;

    if (!userId || !userEmail) {
      return { success: false, error: "User not authenticated" };
    }

    // Prepare persistence
    if (!process.env.DATABASE_URL) {
      return { success: true, message: "Share simulated (DATABASE_URL not configured)" };
    }

    await documentService.initializeTables();

    // Retrieve document to check ownership
    const docRes = await documentService.getDocumentById(documentId);
    if (!docRes.success || !docRes.document) {
      return { success: false, error: "Document not found" };
    }

    const isOwner = docRes.document.user_id === userId;
    const isAdmin = session?.user?.isAdmin === true;
  // Debug logging removed
    if (!isOwner && !isAdmin) {
      return { success: false, error: "You are not authorized to share this document" };
    }

    const addRes = await documentService.addShare(documentId, targetEmail, permission);
    if (!addRes.success) {
      return { success: false, error: addRes.error || "Error adding share" };
    }

    return { success: true, message: "Share successful.", id: addRes.data?.id };
  } catch (error: unknown) {
    console.error("❌ Error addShareAction:", error);
    return { success: false, error: "Error sharing" };
  }
}

export async function fetchDocumentAccessListAction(documentId: number): Promise<ActionResult> {
  try {
    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return { success: false, error: Object.values(idValidation.errors)[0] || 'Invalid document ID' };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, data: { accessList: [] } } as ActionResult;
    }

    await documentService.initializeTables();

    const res = await documentService.fetchDocumentAccessList(documentId);
    if (!res.success) {
      return { success: false, error: res.error || 'Error retrieving access list' };
    }

    return { success: true, data: res.data } as ActionResult;
  } catch (error: unknown) {
    console.error('❌ Error fetchDocumentAccessListAction:', error);
    return { success: false, error: 'Error retrieving access list' };
  }
}
