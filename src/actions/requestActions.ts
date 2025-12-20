"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ActionResult } from "@/lib/types";
import { prisma } from "@/lib/prisma";

async function getAuthenticatedUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return Number.parseInt(session.user.id);
}

// Helper to check admin status
async function isUserAdmin(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { is_admin: true }
    });
    return user?.is_admin === true;
}

export async function createRequestAction(data: {
  type: string;
  title: string;
  description: string;
}): Promise<ActionResult> {
  try {
    const userId = await getAuthenticatedUserId();

    const { type, title, description } = data;

    if (!type || !title || !description) {
      return { success: false, error: "Missing required fields" };
    }

    if (!["help", "data_restoration", "other"].includes(type)) {
      return { success: false, error: "Invalid request type" };
    }

    if (!process.env.DATABASE_URL) {
      return { success: true, message: "Request created (simulated)" };
    }

    const request = await prisma.userRequest.create({
      data: {
        user_id: userId,
        type,
        title: title.trim(),
        description: description.trim(),
        status: "pending",
        validated: false,
      },
    });

    return { success: true, data: { request } };
  } catch (error) {
    console.error("❌ Error createRequestAction:", error);
    return { success: false, error: "Failed to create request" };
  }
}

export async function getRequestsAction(params?: {
  userId?: number;
  limit?: number;
  offset?: number;
}): Promise<ActionResult> {
  try {
    const currentUserId = await getAuthenticatedUserId();
    const isAdmin = await isUserAdmin(currentUserId);

    if (!process.env.DATABASE_URL) {
        return { success: true, data: { requests: [] } };
    }

    let requests;

    if (params?.userId) {
      // Check access permission
      if (params.userId !== currentUserId && !isAdmin) {
        return { success: false, error: "Access denied" };
      }
      
      requests = await prisma.userRequest.findMany({
          where: { user_id: params.userId },
          orderBy: { created_at: "desc" }
      });

    } else {
      // Retrieving all requests requires admin
      if (!isAdmin) {
        return { success: false, error: "Access denied" };
      }
      const limit = params?.limit || 100;
      const offset = params?.offset || 0;
      
      const rawRequests = await prisma.userRequest.findMany({
          take: limit,
          skip: offset,
          orderBy: { created_at: "desc" },
          include: {
              user: {
                  select: { email: true, first_name: true, last_name: true }
              },
              validator: {
                  select: { email: true, first_name: true, last_name: true }
              }
          }
      });

      // Flatten for frontend consistency if needed, or return as is. 
      // The frontend likely expects user_email, user_name, etc. if it was using the repository.
      // Repository did: user_email, user_name (concat), validator_email, validator_name (concat).
      // We should map it to match that interface to avoid frontend breakage.
      
      requests = rawRequests.map(r => ({
          ...r,
          user_email: r.user.email,
          user_name: `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim(),
          validator_email: r.validator?.email || "",
          validator_name: r.validator ? `${r.validator.first_name || ''} ${r.validator.last_name || ''}`.trim() : "",
          user: undefined, // remove nested objects if frontend doesn't expect them
          validator: undefined
      }));
    }

    return { success: true, data: { requests } };
  } catch (error) {
    console.error("❌ Error getRequestsAction:", error);
    return { success: false, error: "Failed to retrieve requests" };
  }
}
