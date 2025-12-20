import { prisma } from '../prisma';
import type { Document, DocumentRepositoryResult, CreateDocumentData, TrashDocument } from '../types';

export class PrismaDocumentRepository {
  async createDocument(data: CreateDocumentData): Promise<DocumentRepositoryResult<Document>> {
    try {
      const document = await prisma.document.create({
        data: {
          user_id: data.userId,
          title: data.title,
          content: data.content,
          tags: data.tags,
        },
      });

      return {
        success: true,
        document,
      };
    } catch (error: unknown) {
      console.error('❌ Error creating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDocumentById(id: number): Promise<DocumentRepositoryResult<Document>> {
    try {
      const document = await prisma.document.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!document) {
        return {
          success: false,
          error: 'Document not found',
        };
      }

      // Transform the document to match our interface
      const transformedDocument: Document = {
        id: document.id,
        user_id: document.user_id,
        title: document.title,
        content: document.content,
        tags: document.tags,
        is_favorite: (document as any).is_favorite ?? null,
        created_at: document.created_at,
        updated_at: document.updated_at,
        username: document.user.username || undefined,
        first_name: document.user.first_name || undefined,
        last_name: document.user.last_name || undefined,
      };

      return {
        success: true,
        document: transformedDocument,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUserDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      const documents = await prisma.document.findMany({
        where: { user_id: userId },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { updated_at: 'desc' },
        take: limit,
        skip: offset,
      });

      // Transform the documents to match our interface
      const transformedDocuments: Document[] = documents.map((doc: {
        id: number;
        user_id: number;
        title: string;
        content: string;
        tags: string[];
        is_favorite?: boolean | null;
        created_at: Date;
        updated_at: Date;
        user: {
          username: string | null;
          first_name: string | null;
          last_name: string | null;
        };
      }) => ({
        id: doc.id,
        user_id: doc.user_id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        is_favorite: (doc as any).is_favorite ?? null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        username: doc.user.username ?? undefined,
        first_name: doc.user.first_name ?? undefined,
        last_name: doc.user.last_name ?? undefined,
      }));

      return {
        success: true,
        documents: transformedDocuments,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving user documents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
      };
    }
  }

  async updateDocument(id: number, userId: number, title: string, content: string, tags: string[]): Promise<DocumentRepositoryResult<Document>> {
    try {
      const document = await prisma.document.update({
        where: { id },
        data: {
          title,
          content,
          tags,
        },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      // Verify that the document belongs to the user
      if (document.user_id !== userId) {
        return {
          success: false,
          error: 'You are not authorized to modify this document',
        };
      }

      // Transform the document to match our interface
      const transformedDocument: Document = {
        id: document.id,
        user_id: document.user_id,
        title: document.title,
        content: document.content,
        tags: document.tags,
        is_favorite: (document as any).is_favorite ?? null,
        created_at: document.created_at,
        updated_at: document.updated_at,
        username: document.user.username || undefined,
        first_name: document.user.first_name || undefined,
        last_name: document.user.last_name || undefined,
      };

      return {
        success: true,
        document: transformedDocument,
      };
    } catch (error: unknown) {
      console.error('❌ Error updating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteDocument(id: number, userId: number): Promise<DocumentRepositoryResult<boolean>> {
    try {
      // Verify that the document belongs to the user
      const document = await prisma.document.findUnique({
        where: { id },
        select: { 
          id: true,
          user_id: true,
          title: true,
          content: true,
          tags: true,
          created_at: true,
          updated_at: true,
        },
      });

      if (!document) {
        return {
          success: false,
          error: 'Document not found',
        };
      }

      if (document.user_id !== userId) {
        return {
          success: false,
          error: 'You are not authorized to delete this document',
        };
      }

      // 2. Insert into trash table
    await prisma.trashDocument.create({
      data: {
        user_id: document.user_id,
        title: document.title,
        content: document.content,
        tags: document.tags,
        created_at: document.created_at,
        updated_at: document.updated_at,
        deleted_at: new Date(),
        original_id: document.id,
      },
    });

    // 3. Delete from main table
      await prisma.document.delete({
        where: { id },
      });

      return {
        success: true,
        data: true,
      };
    } catch (error: unknown) {
      console.error('❌ Error deleting document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async deleteDocumentsBulk(userId: number, documentIds: string[]): Promise<DocumentRepositoryResult<{ deletedCount: number }>> {
    try {
      const ids = documentIds.map(id => Number.parseInt(id)).filter(id => !Number.isNaN(id));

      if (ids.length === 0) {
        return {
          success: false,
          error: 'No valid document ID provided',
        };
      }

      // Verify that all documents belong to the user
      const documents = await prisma.document.findMany({
        where: {
          id: { in: ids },
          user_id: userId,
        },
        select: { 
          id: true, 
          user_id: true, 
          title: true, 
          content: true, 
          tags: true, 
          created_at: true, 
          updated_at: true 
        },
      });

      if (documents.length !== ids.length) {
        return {
          success: false,
          error: 'Some documents do not belong to this user',
        };
      }

      // 2. Insert all documents into trash table
      const trashDocuments = documents.map((doc: {
        id: number;
        user_id: number;
        title: string;
        content: string;
        tags: string[];
        created_at: Date;
        updated_at: Date;
      }) => ({
        user_id: doc.user_id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        deleted_at: new Date(),
        original_id: doc.id,
      }));

      await prisma.trashDocument.createMany({
        data: trashDocuments,
      });

      // 3. Delete all documents from main table
      const result = await prisma.document.deleteMany({
        where: {
          id: { in: ids },
          user_id: userId,
        },
      });

      return {
        success: true,
        data: { deletedCount: result.count },
      };
    } catch (error: unknown) {
      console.error('❌ Error bulk deleting documents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async createOrUpdateDocumentById(id: number, userId: number, title: string, content: string, tags: string[], userEmail?: string): Promise<DocumentRepositoryResult<Document>> {
    try {
      // Try to update first
      const existingDocument = await prisma.document.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          Share: true,
        },
      });

      if (existingDocument) {
        // Verify that the document belongs to the user OR has sharing permissions
        const isOwner = existingDocument.user_id === userId;
        let hasSharePermission = false;
        
        if (!isOwner && userEmail) {
          // Check sharing permissions
          hasSharePermission = existingDocument.Share.some(
            share => share.email.toLowerCase().trim() === userEmail.toLowerCase().trim() && share.permission === true
          );
        }
        
        if (!isOwner && !hasSharePermission) {
          return {
            success: false,
            error: 'You are not authorized to modify this document',
          };
        }

        // Update existing document
        const updatedDocument = await prisma.document.update({
          where: { id },
          data: {
            title,
            content,
            tags,
          },
          include: {
            user: {
              select: {
                username: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        });

        // Transform document to match our interface
        const transformedDocument: Document = {
          id: updatedDocument.id,
          user_id: updatedDocument.user_id,
          title: updatedDocument.title,
          content: updatedDocument.content,
          tags: updatedDocument.tags,
          is_favorite: (updatedDocument as any).is_favorite ?? null,
          created_at: updatedDocument.created_at,
          updated_at: updatedDocument.updated_at,
          username: updatedDocument.user.username ?? undefined,
          first_name: updatedDocument.user.first_name ?? undefined,
          last_name: updatedDocument.user.last_name ?? undefined,
        };

        return {
          success: true,
          document: transformedDocument,
        };
      } else {
        // Create new document
        const newDocument = await prisma.document.create({
          data: {
            id,
            user_id: userId,
            title,
            content,
            tags,
          },
          include: {
            user: {
              select: {
                username: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        });

        // Transform document to match our interface
        const transformedDocument: Document = {
          id: newDocument.id,
          user_id: newDocument.user_id,
          title: newDocument.title,
          content: newDocument.content,
          tags: newDocument.tags,
          is_favorite: (newDocument as any).is_favorite ?? null,
          created_at: newDocument.created_at,
          updated_at: newDocument.updated_at,
          username: newDocument.user.username ?? undefined,
          first_name: newDocument.user.first_name ?? undefined,
          last_name: newDocument.user.last_name ?? undefined,
        };

        return {
          success: true,
          document: transformedDocument,
        };
      }
    } catch (error: unknown) {
      console.error('❌ Error creating/updating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  async getUserTrashedDocuments(userId: number, limit: number = 20, offset: number = 0): Promise<DocumentRepositoryResult<TrashDocument[]>> {
    try {
      const trashed = await prisma.trashDocument.findMany({
        where: { user_id: userId },
        orderBy: { deleted_at: 'desc' },
        take: limit,
        skip: offset,
      });

      const mapped: TrashDocument[] = trashed.map((t) => ({
        id: t.id,
        original_id: (t as any).original_id ?? null,
        user_id: t.user_id,
        title: t.title,
        content: t.content,
        tags: t.tags as any,
        created_at: t.created_at as any,
        updated_at: t.updated_at as any,
        deleted_at: t.deleted_at as any,
      }));

      return { success: true, documents: mapped as unknown as any } as any;
    } catch (error: unknown) {
      console.error('❌ Error retrieving trash:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
      } as any;
    }
  }

  async restoreDocumentFromTrash(trashId: number, userId: number): Promise<DocumentRepositoryResult<{ id: number }>> {
    try {
      // Verify document in trash and ownership
      const trashed = await prisma.trashDocument.findUnique({ where: { id: trashId } });
      if (!trashed) {
        return { success: false, error: 'Item not found in trash' };
      }
      if (trashed.user_id !== userId) {
        return { success: false, error: "You are not authorized to restore this item" };
      }

      // Restore by recreating a document (new id)
      const created = await prisma.document.create({
        data: {
          user_id: trashed.user_id,
          title: trashed.title,
          content: trashed.content,
          tags: trashed.tags as any,
          created_at: trashed.created_at,
          updated_at: new Date(),
        },
      });

      // Delete trash entry
      await prisma.trashDocument.delete({ where: { id: trashed.id } });

      return { success: true, data: { id: created.id } };
    } catch (error: unknown) {
      console.error('❌ Error restoring trash:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  async fetchSharedWithUser(email: string): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      const documents = await prisma.document.findMany({
        where: {
          Share: {
            some: {
              email: email,
            },
          },
        },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          Share: {
            where: { email: email },
            select: ({ email: true, permission: true, is_favorite: true } as any),
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      // Transform the documents to match our interface
      const transformedDocuments: Document[] = documents.map((doc: any) => ({
        id: doc.id,
        user_id: doc.user_id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        // for shared documents, use the is_favorite from the share link
        is_favorite: doc.Share?.[0]?.is_favorite ?? null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        username: doc.user.username ?? undefined,
        first_name: doc.user.first_name ?? undefined,
        last_name: doc.user.last_name ?? undefined,
      }));

      return {
        success: true,
        documents: transformedDocuments,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving documents shared with user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
      };
    }
  }

  async fetchSharedByUser(userId: number): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      const documents = await prisma.document.findMany({
        where: {
          user_id: userId,
          Share: {
            some: {},
          },
        },
        include: {
          user: {
            select: {
              username: true,
              first_name: true,
              last_name: true,
            },
          },
          Share: {
            select: ({
              email: true,
              permission: true,
              is_favorite: true,
            } as any),
          },
        },
        orderBy: { updated_at: 'desc' },
      });

      // Transform documents to match our interface
      const transformedDocuments: Document[] = documents.map((doc: any) => ({
        id: doc.id,
        user_id: doc.user_id,
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        is_favorite: (doc as any).is_favorite ?? null,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        username: doc.user.username ?? undefined,
        first_name: doc.user.first_name ?? undefined,
        last_name: doc.user.last_name ?? undefined,
        // Add sharing information
        sharedWith: doc.Share.map((share: any) => ({
          email: share.email,
          permission: share.permission,
        })),
      }));

      return {
        success: true,
        documents: transformedDocuments,
      };
    } catch (error: unknown) {
      console.error('❌ Error retrieving documents shared by user:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        documents: [],
      };
    }
  }

  async toggleFavoriteForDocument(
    documentId: number,
    userId: number,
    value: boolean | null
  ): Promise<DocumentRepositoryResult<{ id: number; is_favorite: boolean | null }>> {
    try {
      const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, user_id: true } });
      if (!doc) return { success: false, error: 'Document not found' };
      if (doc.user_id !== userId) return { success: false, error: "You are not authorized to modify this favorite" };

      // Use raw SQL query to update only is_favorite
      // Temporarily disable the trigger to avoid updating updated_at
      // then re-enable the trigger after update
      await prisma.$executeRaw`SET session_replication_role = replica;`;
      
      try {
        await prisma.$executeRaw`
          UPDATE documents 
          SET is_favorite = ${value}
          WHERE id = ${documentId} AND user_id = ${userId}
        `;
      } finally {
        // Always re-enable trigger, even on error
        await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
      }

      // Retrieve the updated document to return result
      const updated = await prisma.document.findUnique({ 
        where: { id: documentId }, 
        select: { id: true, is_favorite: true } 
      });
      
      if (!updated) {
        return { success: false, error: 'Error retrieving updated document' };
      }

      return { success: true, data: { id: updated.id, is_favorite: (updated as any).is_favorite ?? null } };
    } catch (e: unknown) {
      // Ensure trigger is re-enabled even on error
      try {
        await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
      } catch {}
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  async toggleFavoriteForShare(
    documentId: number,
    email: string,
    value: boolean | null
  ): Promise<DocumentRepositoryResult<{ id: number; is_favorite: boolean | null }>> {
    try {
      const share = await prisma.share.findFirst({ where: { id_doc: documentId, email: email } });
      if (!share) return { success: false, error: 'Share not found for this user' };
      const updated = await prisma.share.update({ where: { id: share.id }, data: ({ is_favorite: value } as any) });
      return { success: true, data: { id: updated.id, is_favorite: (updated as any).is_favorite ?? null } };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  async getFavorites(userId: number, email: string): Promise<DocumentRepositoryResult<Document[]>> {
    try {
      const own = await prisma.document.findMany({
        where: ({ user_id: userId, is_favorite: true } as any),
        include: {
          user: { select: { username: true, first_name: true, last_name: true } },
        },
        orderBy: { updated_at: 'desc' },
      });

      const shared = await prisma.document.findMany({
        where: ({ Share: { some: { email: email, is_favorite: true } } } as any),
        include: {
          user: { select: { username: true, first_name: true, last_name: true } },
          Share: ({ where: { email: email }, select: { is_favorite: true } } as any),
        },
        orderBy: { updated_at: 'desc' },
      });

      const mappedOwn: Document[] = own.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        title: d.title,
        content: d.content,
        tags: d.tags,
        is_favorite: d.is_favorite ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
        username: d.user?.username ?? undefined,
        first_name: d.user?.first_name ?? undefined,
        last_name: d.user?.last_name ?? undefined,
      }));

      const mappedShared: Document[] = shared.map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        title: d.title,
        content: d.content,
        tags: d.tags,
        is_favorite: d.Share?.[0]?.is_favorite ?? null,
        created_at: d.created_at,
        updated_at: d.updated_at,
        username: d.user?.username ?? undefined,
        first_name: d.user?.first_name ?? undefined,
        last_name: d.user?.last_name ?? undefined,
      }));

      const byId = new Map<number, Document>();
      [...mappedOwn, ...mappedShared].forEach(doc => { byId.set(doc.id, doc); });
      return { success: true, documents: Array.from(byId.values()) };
    } catch (e: unknown) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error', documents: [] };
    }
  }

  async initializeTables(): Promise<void> {
    // Prisma automatically handles table creation via migrations
    // This method is kept for compatibility
    return;
  }
}
