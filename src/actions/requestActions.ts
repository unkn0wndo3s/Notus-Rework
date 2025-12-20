"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { RequestService } from "@/lib/services/RequestService";
import { UserService } from "@/lib/services/UserService";
import { ActionResult } from "@/lib/types";

const requestService = new RequestService();
const userService = new UserService();

async function getAuthenticatedUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return Number.parseInt(session.user.id);
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

    await requestService.initializeTables();

    const result = await requestService.createRequest({
      user_id: userId,
      type: type as "help" | "data_restoration" | "other",
      title: title.trim(),
      description: description.trim(),
    });

    if (!result.success) {
      return { success: false, error: result.error || "Failed to create request" };
    }

    // ActionResult doesn't have 'request' field yet, but data can be used
    return { success: true, data: { request: result.request } };
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
    const isAdmin = await userService.isUserAdmin(currentUserId);

    await requestService.initializeTables();

    let result;

    if (params?.userId) {
      // Check access permission
      if (params.userId !== currentUserId && !isAdmin) {
        return { success: false, error: "Access denied" };
      }
      result = await requestService.getRequestsByUser(params.userId);
    } else {
      // Retrieving all requests requires admin
      if (!isAdmin) {
        return { success: false, error: "Access denied" };
      }
      const limit = params?.limit || 100;
      const offset = params?.offset || 0;
      result = await requestService.getAllRequests(limit, offset);
    }

    if (!result.success) {
      return { success: false, error: result.error || "Failed to retrieve requests" };
    }

    // Return as 'data' since 'requests' might not be in ActionResult
    return { success: true, data: { requests: result.requests } };
  } catch (error) {
    console.error("❌ Error getRequestsAction:", error);
    return { success: false, error: "Failed to retrieve requests" };
  }
}
