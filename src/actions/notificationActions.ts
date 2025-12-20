"use server";

import { NotificationService } from "@/lib/services/NotificationService";
import { authOptions } from "../../lib/auth";
import { revalidatePath } from "next/cache";

const notifSvc = new NotificationService();

/**
 * Helper to ensure the user is authenticated and return their ID.
 */
import { getServerSession } from "next-auth";

// ...

async function getAuthenticatedUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return Number.parseInt(session.user.id);
}

/**
 * Retrieves notifications for a user.
 */
export async function getNotifications(userId: number) {
  try {
    const currentUserId = await getAuthenticatedUserId();

    if (userId !== currentUserId) {
        return { success: false, error: "Access denied" };
    }

    await notifSvc.initializeTables();
    const result = await notifSvc.getNotificationsForUser(userId);
    
    return result;
  } catch (error) {
    console.error("❌ Error retrieving notifications:", error);
    return { success: false, error: "Failed to retrieve notifications" };
  }
}

/**
 * Marks a notification as read.
 */
export async function markAsRead(notificationId: number) {
  try {
    const currentUserId = await getAuthenticatedUserId();

    // Verify ownership (the service/repo doesn't check ownership internally for update)
    const { pool } = await import("@/lib/repositories/BaseRepository");
    const checkRes = await pool.query<{ id_receiver: number }>(
      `SELECT id_receiver FROM notifications WHERE id = $1`,
      [notificationId]
    );

    if (!checkRes.rows || checkRes.rows.length === 0 || checkRes.rows[0].id_receiver !== currentUserId) {
      return { success: false, error: "Access denied" };
    }

    const result = await notifSvc.markNotificationAsRead(notificationId);
    
    revalidatePath("/notifications"); // Or wherever notifications are displayed

    return result;
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    return { success: false, error: "Failed to mark as read" };
  }
}

/**
 * Marks all notifications as read for the current user.
 */
export async function markAllAsRead() {
    try {
        const currentUserId = await getAuthenticatedUserId();
        const result = await notifSvc.markAllAsRead(currentUserId);
        
        revalidatePath("/notifications");
        
        return result;
    } catch (error) {
        console.error("❌ Error marking all notifications as read:", error);
        return { success: false, error: "Failed to mark all as read" };
    }
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(notificationId: number) {
  try {
    const currentUserId = await getAuthenticatedUserId();

    // Verify ownership
    const { pool } = await import("@/lib/repositories/BaseRepository");
    const checkRes = await pool.query<{ id_receiver: number }>(
      `SELECT id_receiver FROM notifications WHERE id = $1`,
      [notificationId]
    );

    if (!checkRes.rows || checkRes.rows.length === 0 || checkRes.rows[0].id_receiver !== currentUserId) {
      return { success: false, error: "Access denied" };
    }

    const result = await notifSvc.deleteNotification(notificationId);
    
    revalidatePath("/notifications");

    return result;
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    return { success: false, error: "Failed to delete notification" };
  }
}

/**
 * Gets the unread notification count for the current user.
 */
export async function getUnreadCount() {
  try {
    const currentUserId = await getAuthenticatedUserId();
    const result = await notifSvc.getUnreadCount(currentUserId);
    
    return result;
  } catch (error) {
    console.error("❌ Error getting unread count:", error);
    return { success: false, error: "Failed to get unread count" };
  }
}
