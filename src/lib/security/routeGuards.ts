import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { DocumentService } from "../services/DocumentService";
import { UserService } from "../services/UserService";
import { prisma } from "../prisma";

const documentService = new DocumentService();
const userService = new UserService();

export interface AuthResult {
  userId: number;
  email: string;
  isAdmin: boolean;
}

export async function requireAuth(): Promise<NextResponse | AuthResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  const userId = parseInt(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 401 }
    );
  }

  const email = session.user.email?.toLowerCase().trim() ?? "";
  const isAdmin = session.user.isAdmin ?? false;

  return { userId, email, isAdmin };
}

export async function requireAdmin(): Promise<NextResponse | AuthResult> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  if (!authResult.isAdmin) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return authResult;
}

export async function requireDocumentAccess(
  documentId: number,
  userId?: number,
  email?: string
): Promise<NextResponse | null> {
  if (!documentId || documentId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const hasAccess = await documentService.userHasAccessToDocument(
    documentId,
    userId,
    email
  );

  if (!hasAccess) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export async function requireDocumentOwnership(
  documentId: number,
  userId: number,
  allowAdmin = true
): Promise<NextResponse | null> {
  if (!documentId || documentId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const ownerResult = await documentService.ownerIdForDocument(documentId);
  if (!ownerResult.success || !ownerResult.data?.ownerId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 404 }
    );
  }

  const ownerId = ownerResult.data.ownerId;
  const isOwner = userId === ownerId;

  if (!isOwner) {
    if (allowAdmin) {
      const isAdmin = await userService.isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }
  }

  return null;
}

export async function requireFolderOwnership(
  folderId: number,
  userId: number
): Promise<NextResponse | null> {
  if (!folderId || folderId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  // Using prisma.folder
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, user_id: userId },
  });

  if (!folder) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export async function requireNotificationOwnership(
  notificationId: number,
  userId: number
): Promise<NextResponse | null> {
  if (!notificationId || notificationId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const { pool } = await import("../repositories/BaseRepository");
  const result = await pool.query<{ id_receiver: number }>(
    `SELECT id_receiver FROM notifications WHERE id = $1`,
    [notificationId]
  );

  if (!result.rows || result.rows.length === 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 404 }
    );
  }

  if (result.rows[0].id_receiver !== userId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export async function requireRequestAccess(
  requestId: number,
  userId: number,
  allowAdmin = true
): Promise<NextResponse | null> {
  if (!requestId || requestId <= 0) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const { RequestService } = await import("../services/RequestService");
  const requestService = new RequestService();
  await requestService.initializeTables();

  const result = await requestService.getRequestById(requestId);
  if (!result.success || !result.request) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 404 }
    );
  }

  const isOwner = result.request.user_id === userId;
  if (!isOwner) {
    if (allowAdmin) {
      const isAdmin = await userService.isUserAdmin(userId);
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }
  }

  return null;
}

export async function requireUserMatch(
  requestedUserId: number | string | null,
  currentUserId: number
): Promise<NextResponse | null> {
  if (!requestedUserId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const parsedId =
    typeof requestedUserId === "number"
      ? requestedUserId
      : Number.parseInt(String(requestedUserId), 10);

  if (!Number.isFinite(parsedId) || parsedId !== currentUserId) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

export async function requireEmailMatch(
  requestedEmail: string | null,
  currentEmail: string
): Promise<NextResponse | null> {
  if (!requestedEmail) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 400 }
    );
  }

  const normalizedRequested = requestedEmail.toLowerCase().trim();
  const normalizedCurrent = currentEmail.toLowerCase().trim();

  if (normalizedRequested !== normalizedCurrent) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return null;
}

