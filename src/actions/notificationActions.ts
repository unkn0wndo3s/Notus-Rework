"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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

    if (!process.env.DATABASE_URL) {
         return { success: true, notifications: [] };
    }

    const notifications = await prisma.notification.findMany({
        where: { id_receiver: userId },
        orderBy: { send_date: "desc" },
        take: 50 // Limit to recent 50
    });
    
    return { success: true, notifications };
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

    if (!process.env.DATABASE_URL) return { success: true };

    // Verify ownership
    const notif = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { id_receiver: true }
    });

    if (!notif || notif.id_receiver !== currentUserId) {
      return { success: false, error: "Access denied" };
    }

    await prisma.notification.update({
        where: { id: notificationId },
        data: { read_date: new Date() }
    });
    
    revalidatePath("/notifications");

    return { success: true };
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

        if (!process.env.DATABASE_URL) return { success: true };

        await prisma.notification.updateMany({
            where: { 
                id_receiver: currentUserId,
                read_date: null
            },
            data: { read_date: new Date() }
        });
        
        revalidatePath("/notifications");
        
        return { success: true };
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

    if (!process.env.DATABASE_URL) return { success: true };

    const notif = await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { id_receiver: true }
    });

    if (!notif || notif.id_receiver !== currentUserId) {
      return { success: false, error: "Access denied" };
    }

    await prisma.notification.delete({
        where: { id: notificationId }
    });
    
    revalidatePath("/notifications");

    return { success: true };
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

    if (!process.env.DATABASE_URL) return { success: true, count: 0 };

    const count = await prisma.notification.count({
        where: { 
            id_receiver: currentUserId,
            read_date: null
        }
    });
    
    return { success: true, count };
  } catch (error) {
    console.error("❌ Error getting unread count:", error);
    return { success: false, error: "Failed to get unread count" };
  }
}
