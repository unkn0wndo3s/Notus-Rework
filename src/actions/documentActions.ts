"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DocumentValidator } from "@/lib/validators/DocumentValidator";
import { ActionResult } from "@/lib/types";
import { recordDocumentHistoryImmediate } from "@/lib/documentHistory";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// --- Helper Functions ---

async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return {
    id: Number(session.user.id),
    email: session.user.email,
    isAdmin: session.user.isAdmin === true,
  };
}

// --- Document Actions ---

export async function createDocumentAction(prevState: unknown, formData: FormData): Promise<ActionResult | string> {
  try {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const userIdRaw = formData.get("userId") as string;
    const rawTags = formData.get("tags") as string;

    if (!userIdRaw) {
      return "User required.";
    }

    let userIdNumber: number;
    // Handle simulation/special IDs if necessary, though ideally we stick to real IDs
    if (userIdRaw === "oauth-simulated-user") {
      userIdNumber = 1;
    } else {
      userIdNumber = parseInt(userIdRaw);
      if (isNaN(userIdNumber) || userIdNumber <= 0) {
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

    // Validation
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

    const document = await prisma.document.create({
      data: {
        user_id: userIdNumber,
        title: title.trim(),
        content: content || "",
        tags: tags,
      },
    });

    revalidatePath("/documents");
    return {
      success: true,
      message: "Document created successfully!",
      documentId: document.id,
    };
  } catch (error) {
    console.error("❌ Error creating document:", error);
    return "Error creating document. Please try again.";
  }
}

export async function getUserDocumentsAction(userId: number, limit: number = 20, offset: number = 0): Promise<ActionResult> {
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
       return { success: true, documents: [] };
    }

    const documents = await prisma.document.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            username: true,
            first_name: true,
            last_name: true,
          }
        },
        Share: {
          select: {
            email: true,
            permission: true,
          }
        },
        folder_documents: {
          select: {
            folder_id: true
          }
        }
      }
    });

    // Transform to match expected frontend interface
    const transformedDocuments = documents.map(doc => ({
      ...doc,
      username: doc.user.username ?? undefined,
      first_name: doc.user.first_name ?? undefined,
      last_name: doc.user.last_name ?? undefined,
      sharedWith: doc.Share, // Frontend expects { email, permission } array
      folderIds: doc.folder_documents.map(fd => fd.folder_id),
      shared: doc.Share.length > 0,
      user: undefined, // Remove nested user object if not needed directly
      Share: undefined,
      folder_documents: undefined
    }));

    return {
      success: true,
      documents: transformedDocuments,
    };
  } catch (error) {
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
    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return {
        success: false,
        error: Object.values(idValidation.errors)[0] || "Invalid document ID",
        document: undefined,
      };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, document: undefined };
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        user: {
            select: {
                username: true,
                first_name: true,
                last_name: true
            }
        }
      }
    });

    if (!document) {
      return { success: false, error: "Document not found" };
    }

    const { user, ...docData } = document;
    return {
      success: true,
      document: {
          ...docData,
          username: user.username ?? undefined,
          first_name: user.first_name ?? undefined,
          last_name: user.last_name ?? undefined,
      },
    };
  } catch (error) {
    console.error("❌ Error retrieving document:", error);
    return {
      success: false,
      error: "Error retrieving document.",
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
    if (!formDataOrObj) {
      return { ok: false, error: "No data provided" };
    }

    const fd = formDataOrObj instanceof FormData ? formDataOrObj : null;
    const documentId = fd
      ? String(fd.get("documentId") || "")
      : String((formDataOrObj as UpdateDocumentPayload).documentId || "");

    if (!documentId) return { ok: false, error: "Missing documentId" };

    const idValidation = DocumentValidator.validateDocumentId(documentId);
    if (!idValidation.isValid) {
      return { ok: false, error: Object.values(idValidation.errors)[0] };
    }
    const idNum = Number(documentId);

    // Auth resolution
    let userIdToUse: number | undefined;
    let userEmail: string | undefined;

    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) userIdToUse = Number(session.user.id);
      if (session?.user?.email) userEmail = session.user.email;
    } catch (e) {
      console.warn("Session check failed", e);
    }

    // Fallback to payload if session missing (e.g. simulation or client override if allowed)
    // Note: Trusting client userId is dangerous for production, but replicating existing logic.
    if (!userIdToUse) {
       if (fd) {
         const u = fd.get("userId");
         if (u) userIdToUse = Number(String(u));
         const e = fd.get("email");
         if (e) userEmail = String(e);
       } else {
         const payload = formDataOrObj as UpdateDocumentPayload;
         if (payload.userId) userIdToUse = Number(payload.userId);
         if (payload.email) userEmail = payload.email;
       }
    }

    if (!userIdToUse) {
      return { ok: false, error: "Not authenticated" };
    }

    // Parse content
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
    } catch {
      tags = [];
    }

    const validation = DocumentValidator.validateDocumentData({
      title,
      content: contentStr,
      tags,
    });

    if (!validation.isValid) {
      return { ok: false, error: Object.values(validation.errors)[0] };
    }

    if (!process.env.DATABASE_URL) {
       return { ok: true, id: idNum }; // Simulation
    }

    // Check permissions and existence
    const existingDoc = await prisma.document.findUnique({ where: { id: idNum } });

    if (!existingDoc) {
        // Create if not exists (Upsert logic from legacy)
        // But usually updateAction implies checking existence.
        // Legacy createOrUpdateDocumentById handled both.
        // We will assume update here. If create is needed, use createDocumentAction.
        // Wait, legacy code allowed creating with a specific ID? Not usually possible with serial, but maybe.
        // Let's stick to update logic. If not found, error.
        // Exception: If legacy behavior specifically allowed "upsert", we can use prisma.upsert.
        // But the previous createOrUpdateDocumentById logic was: if documentId provided => update. else => create.
        // Here we HAVE documentId. So it's an update.
        return { ok: false, error: "Document not found" };
    }

    // Verification of ownership or shared permission
    const isOwner = existingDoc.user_id === userIdToUse;
    let hasEditPermission = isOwner;

    if (!isOwner && userEmail) {
        const share = await prisma.share.findFirst({
            where: {
                id_doc: idNum,
                email: userEmail, // Assuming email case sensitivity is handled or we normalize
                permission: true
            }
        });
        if (share) hasEditPermission = true;
    }

    if (!hasEditPermission) {
        return { ok: false, error: "Unauthorized to edit this document" };
    }

    // Record History
    await recordDocumentHistoryImmediate({
      documentId: idNum,
      userId: userIdToUse,
      userEmail,
      previousContent: existingDoc.content,
      nextContent: contentStr,
    });

    // Update
    const updatedDoc = await prisma.document.update({
      where: { id: idNum },
      data: {
        title,
        content: contentStr,
        tags,
      }
    });

    revalidatePath(`/documents/${idNum}`);
    revalidatePath("/documents");

    return {
      ok: true,
      id: idNum,
      dbResult: { success: true, document: updatedDoc }
    };

  } catch (err: unknown) {
    console.error(err);
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

export async function deleteDocumentAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const documentId = parseInt(formData.get("documentId") as string);
    const userId = parseInt(formData.get("userId") as string);

    if (!documentId || !userId) return "Document and User ID required.";

    if (!process.env.DATABASE_URL) return "Deleted (simulation).";

    const doc = await prisma.document.findFirst({
        where: { id: documentId, user_id: userId }
    });

    if (!doc) return "Document not found or unauthorized.";

    // Archive to Trash
    await prisma.trashDocument.create({
        data: {
            user_id: doc.user_id,
            title: doc.title,
            content: doc.content,
            tags: doc.tags,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            deleted_at: new Date(),
            original_id: doc.id
        }
    });

    await prisma.document.delete({ where: { id: documentId } });

    revalidatePath("/documents");
    return "Document deleted successfully";
  } catch (error) {
    console.error("❌ Error deleting document:", error);
    return "Error deleting document.";
  }
}

export async function deleteMultipleDocumentsAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const userId = parseInt(formData.get("userId") as string);
    const idsRaw = formData.getAll("documentIds") as string[];
    const ids = idsRaw.map(id => parseInt(id)).filter(id => !isNaN(id));

    if (!userId || ids.length === 0) return "Invalid input.";

    if (!process.env.DATABASE_URL) return "Deleted (simulation).";

    // Find documents
    const docs = await prisma.document.findMany({
        where: {
            id: { in: ids },
            user_id: userId
        }
    });

    if (docs.length === 0) return "No documents found.";

    // Archive
    await prisma.trashDocument.createMany({
        data: docs.map(d => ({
            user_id: d.user_id,
            title: d.title,
            content: d.content,
            tags: d.tags,
            created_at: d.created_at,
            updated_at: d.updated_at,
            deleted_at: new Date(),
            original_id: d.id
        }))
    });

    // Delete
    await prisma.document.deleteMany({
        where: {
            id: { in: ids },
            user_id: userId
        }
    });

    revalidatePath("/documents");
    return `${docs.length} document(s) deleted successfully`;
  } catch (error) {
    console.error("❌ Error deleting multiple:", error);
    return "Error deleting documents.";
  }
}

export async function fetchSharedDocumentsAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    const userId = session?.user?.id ? Number(session.user.id) : undefined;

    if (!email || !userId) return { success: false, error: "Unauthorized", documents: [] };
    if (!process.env.DATABASE_URL) return { success: true, documents: [] };

    // Shared WITH user
    const sharedWithMe = await prisma.document.findMany({
        where: {
            Share: {
                some: {
                    email: { equals: email, mode: 'insensitive' }
                }
            }
        },
        include: {
            user: true,
            Share: {
                where: {
                    email: { equals: email, mode: 'insensitive' }
                }
            }
        }
    });

    const sharedWithMeTransformed = sharedWithMe.map(doc => ({
        ...doc,
        username: doc.user.username ?? undefined,
        first_name: doc.user.first_name ?? undefined,
        last_name: doc.user.last_name ?? undefined,
        // Inject the specific share details for this user (e.g. is_favorite from share)
        is_favorite: doc.Share[0]?.is_favorite ?? null,
        permission: doc.Share[0]?.permission ?? false,
        user: undefined,
        Share: undefined
    }));

    // Shared BY user
    const sharedByMe = await prisma.document.findMany({
        where: {
            user_id: userId,
            Share: {
                some: {} // Has any share
            }
        },
        include: {
            user: true,
            Share: true
        }
    });

    const sharedByMeTransformed = sharedByMe.map(doc => ({
        ...doc,
        username: doc.user.username ?? undefined,
        first_name: doc.user.first_name ?? undefined,
        last_name: doc.user.last_name ?? undefined,
        sharedWith: doc.Share.map(s => ({ email: s.email, permission: s.permission })),
        user: undefined,
        Share: undefined
    }));

    return { success: true, documents: [...sharedWithMeTransformed, ...sharedByMeTransformed] };
  } catch (error) {
    console.error("❌ Error fetchShared:", error);
    return { success: false, error: "Error fetching shared documents", documents: [] };
  }
}

export async function getSharePermissionAction(documentId: number): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) return { success: false, error: "Unauthorized" };
    if (!process.env.DATABASE_URL) return { success: true, data: { permission: false } };

    const share = await prisma.share.findFirst({
        where: {
            id_doc: documentId,
            email: { equals: email, mode: 'insensitive' }
        },
        select: { permission: true }
    });

    if (!share) return { success: false, error: "Permission not found" };

    return { success: true, data: { permission: share.permission } };
  } catch (error) {
    return { success: false, error: "Error getting permission" };
  }
}

export async function addShareAction(prevState: unknown, formData: FormData): Promise<ActionResult | string> {
    const documentId = parseInt(formData.get("documentId") as string);
    const email = formData.get("email") as string;
    const permission = formData.get("permission") === "true" || formData.get("permission") === "1";

    if (!documentId || !email) return { success: false, error: "Missing fields" };

    try {
        const { id: userId, isAdmin } = await getAuthenticatedUser();
        
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) return { success: false, error: "Document not found" };

        if (doc.user_id !== userId && !isAdmin) {
             return { success: false, error: "Unauthorized" };
        }

        // Upsert share
        // Note: Prisma upsert requires a unique compound key. 
        // We have uq_shares_id_doc_email in DB, presumably mapped in Prisma Schema?
        // Let's check schema. `@@unique([identifier, token])` exists for tokens.
        // For Share? `model Share { ... @@map("shares") }` - No @@unique defined in the snippet I saw earlier for Share!
        // Wait, looking at schema provided in Step 29:
        // `model Share { ... @@map("shares") }` - NO UNIQUE CONSTRAINT on [id_doc, email] in Prisma Schema?!
        // In `DocumentRepository.ts`, `CREATE UNIQUE INDEX IF NOT EXISTS uq_shares_id_doc_email`.
        // If it's in the DB but not in Prisma Schema, `upsert` won't work type-safely or might fail validation.
        // I should use findFirst then update or create to be safe if schema is missing unique attribute.
        
        const existingShare = await prisma.share.findFirst({
            where: {
                id_doc: documentId,
                email: { equals: email, mode: 'insensitive' }
            }
        });

        if (existingShare) {
             await prisma.share.update({
                 where: { id: existingShare.id },
                 data: { permission }
             });
        } else {
             await prisma.share.create({
                 data: {
                     id_doc: documentId,
                     email,
                     permission
                 }
             });
        }

        revalidatePath(`/documents/${documentId}`);
        return { success: true, message: "Share added/updated." };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Error sharing" };
    }
}

export async function toggleFavoriteAction(prevState: unknown, formData: FormData): Promise<ActionResult> {
    try {
        const documentId = parseInt(formData.get("documentId") as string);
        const value = formData.get("value");
        const isFavorite = value === "1" || value === "true";

        const { id: userId, email } = await getAuthenticatedUser();

        // Check if owner
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (doc && doc.user_id === userId) {
            await prisma.document.update({
                where: { id: documentId },
                data: { is_favorite: isFavorite }
            });
            return { success: true };
        }

        // Check if shared
        if (email) {
            const share = await prisma.share.findFirst({
                where: {
                    id_doc: documentId,
                    email: { equals: email, mode: 'insensitive' }
                }
            });
            if (share) {
                await prisma.share.update({
                    where: { id: share.id },
                    data: { is_favorite: isFavorite }
                });
                 return { success: true };
            }
        }
        
        return { success: false, error: "Not found or unauthorized" };
    } catch (e) {
        return { success: false, error: "Error toggling favorite" };
    }
}

export async function updateShareAction(documentId: number, email: string, permission: boolean): Promise<ActionResult> {
    // Re-use logic or call addShareAction? keeping it separate for clarity
    try {
        const { id: userId, isAdmin } = await getAuthenticatedUser();
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) return { success: false, error: "Doc not found" };
        if (doc.user_id !== userId && !isAdmin) return { success: false, error: "Unauthorized" };

        const share = await prisma.share.findFirst({
            where: { id_doc: documentId, email: { equals: email, mode: 'insensitive' } }
        });

        if (share) {
             await prisma.share.update({ where: { id: share.id }, data: { permission } });
        } else {
             // Create if missing?
             await prisma.share.create({ data: { id_doc: documentId, email, permission } });
        }
        revalidatePath(`/documents/${documentId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: "Error updating share" };
    }
}

export async function removeShareAction(documentId: number, email: string): Promise<ActionResult> {
     try {
        const { id: userId, isAdmin, email: myEmail } = await getAuthenticatedUser();
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) return { success: false, error: "Doc not found" };

        const isOwner = doc.user_id === userId;
        const isSelf = email.toLowerCase() === myEmail?.toLowerCase();

        if (!isOwner && !isAdmin && !isSelf) {
             return { success: false, error: "Unauthorized" };
        }

        // Delete share
        // We need to find the ID first because delete requires where unique ID (or compound unique, but see above)
        const share = await prisma.share.findFirst({
             where: { id_doc: documentId, email: { equals: email, mode: 'insensitive' } }
        });
        
        if (share) {
             await prisma.share.delete({ where: { id: share.id } });
        }

        revalidatePath(`/documents/${documentId}`);
        return { success: true };
    } catch (e) {
        return { success: false, error: "Error removing share" };
    }
}

export async function fetchDocumentAccessListAction(documentId: number): Promise<ActionResult> {
    try {
        // Fetch owner and shares
        const doc = await prisma.document.findUnique({
             where: { id: documentId },
             include: {
                 user: true,
                 Share: true
             }
        });

        if (!doc) return { success: false, error: "Document not found" };

        const accessList = [];

        // Owner
        accessList.push({
            id: doc.user.id,
            email: doc.user.email,
            username: doc.user.username,
            first_name: doc.user.first_name,
            last_name: doc.user.last_name,
            profile_image: doc.user.profile_image,
            permission: undefined,
            is_owner: true
        });

        // Shared users
        // For shared users, we only have email in Share table. We need to join with User table to get details.
        // Prisma include on Share? Share -> User? No relation in schema yet?
        // Schema: `model Share { ... email String ... }`. No relation to User defined in Share model, only Document.
        // But we DO have `users` table.
        // We need to fetch users matching the emails.
        
        const sharedEmails = doc.Share.map(s => s.email);
        const sharedUsers = await prisma.user.findMany({
             where: { email: { in: sharedEmails, mode: 'insensitive' } }
        });

        const usersMap = new Map(sharedUsers.map(u => [u.email.toLowerCase(), u]));

        for (const share of doc.Share) {
             const u = usersMap.get(share.email.toLowerCase());
             if (u) {
                 accessList.push({
                     id: u.id,
                     email: u.email,
                     username: u.username,
                     first_name: u.first_name,
                     last_name: u.last_name,
                     profile_image: u.profile_image,
                     permission: share.permission,
                     is_owner: false
                 });
             } else {
                 // Shared with email that hasn't registered yet?
                 accessList.push({
                     id: null,
                     email: share.email,
                     permission: share.permission,
                     is_owner: false
                 });
             }
        }

        return { success: true, data: { accessList } };
    } catch (e) {
        return { success: false, error: "Error getting access list" };
    }
}

export async function getDocumentHistoryAction(documentId: number) {
    try {
         const { id: userId, email } = await getAuthenticatedUser();
         
         // Permission check
         const doc = await prisma.document.findUnique({ where: { id: documentId } });
         if (!doc) return { success: false, error: "Not found" };

         let hasAccess = doc.user_id === userId;
         if (!hasAccess && email) {
             const share = await prisma.share.findFirst({
                 where: { id_doc: documentId, email: { equals: email, mode: 'insensitive' } }
             });
             if (share) hasAccess = true;
         }

         if (!hasAccess) return { success: false, error: "Unauthorized" };

         const history = await prisma.documentHistory.findMany({
             where: { document_id: documentId },
             orderBy: { created_at: "asc" },
             include: {
                 user: {
                     select: {
                         id: true,
                         username: true,
                         first_name: true,
                         last_name: true,
                         email: true,
                         profile_image: true
                     }
                 }
             }
         });

         return { success: true, history };
    } catch (e) {
         return { success: false, error: "Error fetching history" };
    }
}

export async function getUserTrashDocumentsAction(userId: number, limit: number = 20, offset: number = 0) {
    try {
        const paginationValidation = DocumentValidator.validatePaginationParams(limit, offset);
        if (!paginationValidation.isValid) {
            return {
                success: false,
                error: Object.values(paginationValidation.errors)[0] || "Invalid pagination parameters",
                documents: [],
            };
        }

        if (!process.env.DATABASE_URL) return { success: true, documents: [] };

        const documents = await prisma.trashDocument.findMany({
            where: { user_id: userId },
            orderBy: { deleted_at: "desc" },
            take: limit,
            skip: offset
        });

        return { success: true, documents };
    } catch (e) {
        return { success: false, error: "Error fetching trash" };
    }
}

export async function restoreTrashedDocumentAction(prevState: unknown, formData: FormData): Promise<string> {
  try {
    const trashIdRaw = formData.get("trashId");
    if (!trashIdRaw) return "Missing trash ID";
    
    const trashId = Number(trashIdRaw);
    if (isNaN(trashId) || trashId <= 0) return "Invalid ID";

    if (!process.env.DATABASE_URL) return "Restored (simulation).";

    const { id: userId } = await getAuthenticatedUser();

    // Verify ownership
    const trashed = await prisma.trashDocument.findUnique({
        where: { id: trashId }
    });

    if (!trashed) return "Document not found in trash";
    if (trashed.user_id !== userId) return "Unauthorized";

    // Restore
    await prisma.$transaction(async (tx) => {
        await tx.document.create({
            data: {
                user_id: trashed.user_id,
                title: trashed.title,
                content: trashed.content,
                tags: trashed.tags as string[], // Cast usage of JSON/array
                created_at: trashed.created_at,
                updated_at: trashed.updated_at
                // original ID logic? If we want to preserve ID, we can try to force it or let it generate new.
                // Usually restore generates new ID or tries to re-use if distinct.
                // Simple restore: New ID.
            }
        });
        await tx.trashDocument.delete({ where: { id: trashId } });
    });

    revalidatePath("/trash");
    revalidatePath("/documents");
    return "Document successfully restored";
  } catch (error) {
    console.error("Restore error:", error);
    return "Error during restoration";
  }
}

export async function restoreTrashedDocumentFormAction(formData: FormData): Promise<void> {
  await restoreTrashedDocumentAction(undefined, formData);
}

export async function getFavoritesAction(): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    const email = session?.user?.email;

    if (!userId || !email) {
      return { success: false, error: "User not authenticated", documents: [] };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, documents: [] };
    }

    // 1. Own favorites
    const ownFavorites = await prisma.document.findMany({
      where: {
        user_id: userId,
        is_favorite: true,
      },
      include: {
        user: { select: { username: true, first_name: true, last_name: true } },
        Share: { select: { email: true, permission: true } },
        folder_documents: { select: { folder_id: true } }
      }
    });

    // 2. Shared favorites
    const sharedFavorites = await prisma.document.findMany({
        where: {
            Share: {
                some: {
                    email: { equals: email, mode: 'insensitive' },
                    is_favorite: true
                }
            }
        },
        include: {
            user: { select: { username: true, first_name: true, last_name: true } },
            Share: { 
                where: { email: { equals: email, mode: 'insensitive' } },
                select: { email: true, permission: true, is_favorite: true } 
            },
            folder_documents: { select: { folder_id: true } }
        }
    });

    // Transform and Combine
    const transformedOwn = ownFavorites.map(doc => ({
      ...doc,
      username: doc.user.username ?? undefined,
      first_name: doc.user.first_name ?? undefined,
      last_name: doc.user.last_name ?? undefined,
      sharedWith: doc.Share,
      folderIds: doc.folder_documents.map(fd => fd.folder_id),
      shared: doc.Share.length > 0,
       user: undefined,
       Share: undefined,
       folder_documents: undefined
    }));

     const transformedShared = sharedFavorites.map(doc => ({
      ...doc,
      username: doc.user.username ?? undefined,
      first_name: doc.user.first_name ?? undefined,
      last_name: doc.user.last_name ?? undefined,
      sharedWith: [],
      folderIds: doc.folder_documents.map(fd => fd.folder_id),
      permission: doc.Share[0]?.permission ?? false,
      is_favorite: true,
      shared: true,
       user: undefined,
       Share: undefined,
       folder_documents: undefined
    }));
    
    return {
        success: true, 
        documents: [...transformedOwn, ...transformedShared]
    };

  } catch (error) {
    console.error("Error fetching favorites:", error);
    return { success: false, error: "Error fetching favorites", documents: [] };
  }
}
