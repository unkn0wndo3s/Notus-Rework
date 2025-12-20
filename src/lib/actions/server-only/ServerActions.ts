"use server";
 
// Server-only actions - no database imports on client side
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import { revalidatePath } from "next/cache";
 
// Dynamic import of services only on server side
async function getUserService() {
  const { PrismaUserService } = await import("../../services/PrismaUserService");
  return new PrismaUserService();
}

async function getDocumentService() {
  const { PrismaDocumentService } = await import("../../services/PrismaDocumentService");
  return new PrismaDocumentService();
}

async function getEmailService() {
  const { EmailService } = await import("../../services/EmailService");
  return new EmailService();
}

// Authentication actions
export async function authenticate(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return "Email and password required";
    }

    const userService = await getUserService();
    
    // Check if user is banned before login attempt
    const userResult = await userService.getUserByEmail(email);
    if (userResult.success && userResult.user?.is_banned) {
      return "This account has been banned. Contact an administrator for more information.";
    }

    const { signIn } = await import("next-auth/react");
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

// Shared documents (uses PrismaDocumentService)
export async function fetchSharedDocumentsAction() {
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

    const documentService = await getDocumentService();
    await documentService.initializeTables();

    const sharedWithResult = await documentService.fetchSharedWithUser(email);
    if (!sharedWithResult.success) {
      return { success: false, error: sharedWithResult.error || "Error retrieving shared documents", documents: [] };
    }

    const sharedByResult = await documentService.fetchSharedByUser(userId);
    if (!sharedByResult.success) {
      return { success: false, error: sharedByResult.error || "Error retrieving shared documents", documents: [] };
    }

    const allSharedDocuments = [
      ...(sharedWithResult.documents || []),
      ...(sharedByResult.documents || [])
    ];

    return { success: true, documents: allSharedDocuments };
  } catch (error: unknown) {
    console.error("❌ fetchSharedDocumentsAction error:", error);
    return { success: false, error: "Error retrieving shared documents", documents: [] };
  }
}

export async function registerUser(_prevState: unknown, formData: FormData): Promise<string> {
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
    const { UserValidator } = await import("../../validators/UserValidator");
    const validation = UserValidator.validateRegistrationData(userData);
    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Registration successful (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Create user
    const result = await userService.createUser(userData);

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

// Document management actions
export async function createDocumentAction(_prevState: unknown, formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const userId = formData.get("userId") as string;
    const rawTags = formData.get("tags") as string;

    if (!userId) {
      return "User required.";
    }

    // Handle different user ID types
    let userIdNumber: number;

    if (!userId || userId === "undefined" || userId === "null" || userId === "unknown") {
      console.error("❌ User ID not defined in session");
      return "Invalid user session. Please log in again.";
    }

    if (userId === "oauth-simulated-user") {
      userIdNumber = 1; // Simulation ID
    } else {
      userIdNumber = Number(userId);
      if (Number.isNaN(userIdNumber) || userIdNumber <= 0) {
        console.error("❌ Invalid user ID:", userId, "Parsed as:", userIdNumber);
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
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
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

    const documentService = await getDocumentService();
    
    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Create a new document
    const result = await documentService.createDocument({
      userId: userIdNumber,
      title: title.trim(),
      content: content || "",
      tags,
    });

    if (!result.success) {
      console.error("❌ Document creation error:", result.error);
      return "Error during document creation. Please try again.";
    }

    return {
      success: true,
      message: "Document created successfully!",
      documentId: result.document!.id,
    };
  } catch (error: unknown) {
    console.error("❌ Error during document creation:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error during document creation. Please try again.";
  }
}


export async function getUserDocumentsAction(userId: number, limit: number = 20, offset: number = 0) {
  try {
    // Pagination parameter validation
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
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
            title: "Simulated Document",
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

    const documentService = await getDocumentService();
    
    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Fetch documents
    const result = await documentService.getUserDocuments(userId, limit, offset);

    if (!result.success) {
      console.error("❌ Error fetching documents:", result.error);
      return {
        success: false,
        error: "Error while fetching documents.",
        documents: [],
      };
    }

    return {
      success: true,
      documents: result.documents || [],
    };
  } catch (error: unknown) {
    console.error("❌ Error while fetching documents:", error);
    return {
      success: false,
      error: "Error while fetching documents.",
      documents: [],
    };
  }
}

// Trash: fetch user's deleted documents
export async function getUserTrashDocumentsAction(userId: number, limit: number = 20, offset: number = 0) {
  try {
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
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
        documents: [],
      };
    }

    const documentService = await getDocumentService();
    const result = await documentService.getUserTrashedDocuments(userId, limit, offset);
    if (!result.success) {
      return { success: false, error: result.error || "Error while fetching trash", documents: [] };
    }
    return { success: true, documents: result.documents || [] };
  } catch (error: unknown) {
    console.error("❌ Trash error:", error);
    return { success: false, error: "Error while fetching trash", documents: [] };
  }
}

// Trash: restore a deleted document
export async function restoreTrashedDocumentAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const trashIdRaw = formData.get("trashId");
    if (!trashIdRaw) {
      return "Missing trash ID";
    }
    const trashId = Number(trashIdRaw);
    if (Number.isNaN(trashId) || trashId <= 0) {
      return "Invalid ID";
    }

    if (!process.env.DATABASE_URL) {
      return "Document restored (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    if (!userId) {
      return "Not authenticated";
    }

    const documentService = await getDocumentService();
    const result = await documentService.restoreDocumentFromTrash(trashId, userId);
    if (!result.success) {
      return result.error || "Error during restoration";
    }
    // Revalidate trash page so UI reflects changes immediately
    try {
      revalidatePath("/trash");
    } catch {}
    return "Document successfully restored";
  } catch (error: unknown) {
    console.error("❌ Trash restoration error:", error);
    return "Error during restoration. Please try again.";
  }
}

// Wrapper for direct use in <form action={...}>
export async function restoreTrashedDocumentFormAction(formData: FormData): Promise<void> {
  await restoreTrashedDocumentAction(undefined, formData);
}

// User profile actions
export async function updateUserProfileAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const session = await getServerSession(authOptions);
    const userIdRaw = session?.user?.id;

    if (!userIdRaw) {
      return "You must be logged in to modify your profile.";
    }

    const email = formData.get("email") as string || undefined;
    const username = formData.get("username") as string || undefined;
    const firstName = formData.get("firstName") as string || undefined;
    const lastName = formData.get("lastName") as string || undefined;
    const profileImage = formData.get("profileImage") as string || undefined;
    const bannerImage = formData.get("bannerImage") as string || undefined;

    // Profile data validation
    const { UserValidator } = await import("../../validators/UserValidator");
    const profileData = {
      email: email?.trim(),
      username: username?.trim(),
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      profileImage,
      bannerImage,
    };

    const validation = UserValidator.validateProfileData(profileData);
    if (!validation.isValid) {
      return Object.values(validation.errors)[0] || "Invalid data";
    }

    const fields: Record<string, string> = {};
    if (email !== undefined) fields.email = email.trim();
    if (username !== undefined) fields.username = username.trim();
    if (firstName !== undefined) fields.firstName = firstName.trim();
    if (lastName !== undefined) fields.lastName = lastName.trim();
    if (profileImage !== undefined) fields.profileImage = profileImage;
    if (bannerImage !== undefined) fields.bannerImage = bannerImage;

    if (Object.keys(fields).length === 0) {
      return "No changes detected.";
    }

    if (!process.env.DATABASE_URL) {
      return "Profile updated (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const userService = await getUserService();
    await userService.initializeTables();

    const userId = Number(userIdRaw);
    const result = await userService.updateUserProfile(userId, fields);

    if (!result.success) {
      return result.error || "Error while updating profile.";
    }

    return "Profile updated successfully!";
  } catch (error: unknown) {
    console.error("❌ Profile update error:", error);
    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }
    return "Error while updating profile. Please try again.";
  }
}

// Password management actions
export async function sendPasswordResetEmailAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const email = formData.get("email") as string;

    if (!email) {
      return "Please enter your email address.";
    }

    // Basic email validation
    const { UserValidator } = await import("../../validators/UserValidator");
    const emailValidation = UserValidator.validateEmail(email);
    if (!emailValidation.isValid) {
      return "Please enter a valid email address.";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Reset email sent (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Send reset email
    const result = await userService.sendPasswordResetEmail(email);

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

export async function resetPasswordAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!token || !password || !confirmPassword) {
      return "All fields are required.";
    }

    // Password validation
    const { UserValidator } = await import("../../validators/UserValidator");
    const passwordValidation = UserValidator.validatePasswordResetData(password, confirmPassword);
    if (!passwordValidation.isValid) {
      return Object.values(passwordValidation.errors)[0] || "Invalid data";
    }

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Password changed successfully (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Reset password
    const result = await userService.resetPassword(token, password);

    if (!result.success) {
      return result.error || "Error while resetting password";
    }

    return "Password changed successfully. You can now log in.";
  } catch (error: unknown) {
    console.error("❌ Error during password reset:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error during reset. Please try again.";
  }
}

// Additional document management actions
export async function getDocumentByIdAction(documentId: number) {
  try {
    // Document ID validation
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
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
          id: Number(documentId),
          user_id: 1,
          title: "Simulated Document",
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

    const documentService = await getDocumentService();
    
    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Fetch document
    const result = await documentService.getDocumentById(Number(documentId));

    if (!result.success) {
      console.error("❌ Error fetching document:", result.error);
      return {
        success: false,
        error: "Error while fetching document.",
        document: undefined,
      };
    }

    return {
      success: true,
      document: result.document,
    };
  } catch (error: unknown) {
    console.error("❌ Error while fetching document:", error);
    return {
      success: false,
      error: "Error while fetching document.",
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

export async function updateDocumentAction(_prevState: unknown, formDataOrObj: FormData | UpdateDocumentPayload) {
  try {
    // Check that formDataOrObj exists and is valid
    if (!formDataOrObj) {
      return { ok: false, error: "No data provided" };
    }

    const fd = formDataOrObj instanceof FormData ? formDataOrObj : null;
    const documentId = fd
      ? String(fd.get("documentId") || "")
      : String((formDataOrObj as UpdateDocumentPayload).documentId || "");
    
    if (!documentId) return { ok: false, error: "Missing documentId" };

    // Document ID validation
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
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
      if (u) clientUserId = Number(u);
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

    const documentService = await getDocumentService();
    
    // Actually update the document in the database
    const updateResult = await documentService.createOrUpdateDocumentById(
      idNum,
      userIdToUse,
      userEmail,
      title,
      contentStr,
      tags
    );

    if (!updateResult.success) {
      console.error("❌ Document update error:", updateResult.error);
      return {
        ok: false,
        error: updateResult.error || "Error while updating document.",
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

export async function deleteDocumentAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const documentId = formData.get("documentId") as string;
    const userId = formData.get("userId") as string;

    if (!documentId || !userId) {
      return "Document ID and user required.";
    }

    // ID validation
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
    const documentIdValidation = DocumentValidator.validateDocumentId(documentId);
    if (!documentIdValidation.isValid) {
      return Object.values(documentIdValidation.errors)[0] || "Invalid document ID";
    }

    const userIdValidation = DocumentValidator.validateUserId(userId);
    if (!userIdValidation.isValid) {
      return Object.values(userIdValidation.errors)[0] || "Invalid user ID";
    }

    const documentIdNumber = Number(documentId);
    const userIdNumber = Number(userId);

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return "Document successfully deleted (simulation mode). Configure DATABASE_URL for persistence.";
    }

    const documentService = await getDocumentService();
    
    // Initialize tables if they don't exist
    await documentService.initializeTables();

    // Delete document
    const result = await documentService.deleteDocument(documentIdNumber, userIdNumber);

    if (!result.success) {
      console.error("❌ Document deletion error:", result.error);
      return result.error!;
    }

    return "Document successfully deleted";
  } catch (error: unknown) {
    console.error("❌ Error while deleting document:", error);

    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }

    return "Error while deleting document. Please try again.";
  }
}

export async function deleteMultipleDocumentsAction(_prevState: unknown, formData: FormData): Promise<string> {
  try {
    const userId = formData.get("userId") as string;
    const idsRaw = formData.getAll("documentIds") as string[];

    if (!userId) {
      return "User ID required.";
    }

    // User ID validation
    const { DocumentValidator } = await import("../../validators/DocumentValidator");
    const userIdValidation = DocumentValidator.validateUserId(userId);
    if (!userIdValidation.isValid) {
      return Object.values(userIdValidation.errors)[0] || "Invalid user ID";
    }

    // Document IDs validation
    const documentIdsValidation = DocumentValidator.validateDocumentIds(idsRaw);
    if (!documentIdsValidation.isValid) {
      return Object.values(documentIdsValidation.errors)[0] || "Invalid document IDs";
    }

    const userIdNumber = Number(userId);

    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return `${idsRaw.length} document(s) deleted (simulation mode). Configure DATABASE_URL for persistence.`;
    }

    const documentService = await getDocumentService();
    await documentService.initializeTables();

    const result = await documentService.deleteDocumentsBulk(userIdNumber, idsRaw);

    if (!result.success) {
      return result.error || "Error while bulk deleting.";
    }

    return `${result.data?.deletedCount || 0} document(s) successfully deleted`;
  } catch (error: unknown) {
    console.error("❌ Error during bulk deletion:", error);
    if (error && typeof error === 'object' && 'code' in error && 
        (error.code === "ECONNRESET" || error.code === "ECONNREFUSED")) {
      return "Database not accessible. Check PostgreSQL configuration.";
    }
    return "Error while bulk deleting. Please try again.";
  }
}

// Additional user profile actions
export async function getUserProfileAction(userId: number) {
  try {
    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return {
        success: true,
        user: {
          id: userId,
          email: "test@example.com",
          username: "simulation",
          password_hash: undefined,
          first_name: "Test",
          last_name: "User",
          email_verified: true,
          email_verification_token: undefined,
          provider: undefined,
          provider_id: undefined,
          created_at: new Date(),
          updated_at: new Date(),
          reset_token: undefined,
          reset_token_expiry: undefined,
          is_admin: false,
          is_banned: false,
          terms_accepted_at: new Date(),
          profile_image: undefined,
          banner_image: undefined,
        },
      };
    }

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Fetch full user data
    const result = await userService.getUserById(userId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "User not found",
      };
    }

    return {
      success: true,
      user: result.user,
    };
  } catch (error: unknown) {
    console.error("❌ Error while fetching user profile:", error);
    return {
      success: false,
      error: "Error while fetching profile",
    };
  }
}

export async function getUserIdByEmailAction(email: string) {
  try {
    // Check if database is configured
    if (!process.env.DATABASE_URL) {
      return {
        success: true,
        userId: "1", // Simulation ID
      };
    }

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Fetch user ID by email
    const result = await userService.getUserByEmail(email);

    if (!result.success) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return {
      success: true,
      userId: result.user!.id.toString(),
    };
  } catch (error: unknown) {
    console.error("❌ Error while fetching user ID:", error);
    return {
      success: false,
      error: "Error while fetching user ID",
    };
  }
}

// Admin actions
export async function getAllUsersAction() {
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

    const userService = await getUserService();
    
    // Initialize tables if they don't exist
    await userService.initializeTables();

    // Fetch all users
    const result = await userService.getAllUsers();

    if (!result.success) {
      console.error("❌ Error fetching users:", result.error);
      return {
        success: false,
        error: "Error while fetching users.",
        users: [],
      };
    }

    return {
      success: true,
      users: result.users || [],
    };
  } catch (error: unknown) {
    console.error("❌ Error while fetching users:", error);
    return {
      success: false,
      error: "Error while fetching users.",
      users: [],
    };
  }
}

// --- Favorites ---
export async function toggleFavoriteAction(_prevState: unknown, formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const email = session?.user?.email as string | undefined;
    if (!userId || !email) {
      return { success: false, error: "User not authenticated" };
    }

    const documentIdRaw = formData.get("documentId");
    const valueRaw = formData.get("value");
    if (!documentIdRaw) return { success: false, error: "documentId required" };
    const documentId = Number(documentIdRaw);
    if (Number.isNaN(documentId) || documentId <= 0) return { success: false, error: "Invalid document ID" };
    const value = valueRaw === "1" || valueRaw === "true" ? true : null;

    if (!process.env.DATABASE_URL) {
      return { success: true, message: "Simulated favorite (DATABASE_URL not configured)" };
    }

    const docSvc = await getDocumentService();
    await docSvc.initializeTables();

    const docRes = await docSvc.getDocumentById(documentId);
    if (!docRes.success || !docRes.document) {
      return { success: false, error: docRes.error || "Document not found" };
    }

    if (docRes.document.user_id === userId) {
      const res = await docSvc.toggleFavoriteForDocument(documentId, userId, value);
      if (!res.success) return { success: false, error: res.error || "Error while updating favorite" };
      return { success: true };
    } else {
      const res = await docSvc.toggleFavoriteForShare(documentId, email, value);
      if (!res.success) return { success: false, error: res.error || "Error while updating favorite" };
      return { success: true };
    }
  } catch (error: unknown) {
    return { success: false, error: String(error instanceof Error ? error.message : error) };
  }
}

export async function getFavoritesAction() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const email = session?.user?.email as string | undefined;
    if (!userId || !email) {
      return { success: false, error: "User not authenticated", documents: [] };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, documents: [] };
    }

    const docSvc = await getDocumentService();
    const res = await docSvc.getFavorites(userId, email);
    if (!res.success) return { success: false, error: res.error || "Favorite error", documents: [] };
    return { success: true, documents: res.documents };
  } catch (error: unknown) {
    return { success: false, error: String(error instanceof Error ? error.message : error), documents: [] };
  }
}
