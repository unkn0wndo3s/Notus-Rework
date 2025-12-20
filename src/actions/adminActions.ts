"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailService } from "@/lib/services/EmailService";

const emailService = new EmailService();

async function checkAdminAccess() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) return false;

  // Check if admin (using database to be sure)
  const user = await prisma.user.findUnique({
      where: { id: Number(session.user.id) },
      select: { is_admin: true }
  });

  return user?.is_admin === true;
}

// --- Stats Helpers ---

async function getUsersGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    // Postgres Syntax
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', created_at)";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', created_at), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', created_at)";
        break;
    }

    try {
        const result: any[] = await prisma.$queryRawUnsafe(`
            SELECT ${dateFormat} as date, COUNT(*) as count
            FROM users
            WHERE created_at >= NOW() - INTERVAL '${interval}'
            GROUP BY ${groupBy}
            ORDER BY date ASC
        `);
        return result.map(r => ({ date: r.date, count: Number(r.count) }));
    } catch (e) {
        console.warn("Stats error:", e);
        return [];
    }
}

async function getDocumentsGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    // Same logic as users, but table documents
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', created_at)";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', created_at)";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', created_at), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', created_at)";
        break;
    }

    try {
        const result: any[] = await prisma.$queryRawUnsafe(`
            SELECT ${dateFormat} as date, COUNT(*) as count
            FROM documents
            WHERE created_at >= NOW() - INTERVAL '${interval}'
            GROUP BY ${groupBy}
            ORDER BY date ASC
        `);
        return result.map(r => ({ date: r.date, count: Number(r.count) }));
    } catch (e) {
        return [];
    }
}

async function getSharesGroupedByPeriod(period: 'day' | 'week' | 'month' | 'year'): Promise<Array<{ date: string; count: number }>> {
    // Logic involving join and COALESCE
    let dateFormat: string;
    let interval: string;
    let groupBy: string;
    
    switch (period) {
      case 'day':
        dateFormat = "TO_CHAR(DATE_TRUNC('day', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "7 days";
        groupBy = "DATE_TRUNC('day', COALESCE(s.share_at, d.created_at))";
        break;
      case 'week':
        dateFormat = "TO_CHAR(DATE_TRUNC('week', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "4 weeks";
        groupBy = "DATE_TRUNC('week', COALESCE(s.share_at, d.created_at))";
        break;
      case 'month':
        dateFormat = "TO_CHAR(DATE_TRUNC('month', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "12 months";
        groupBy = "DATE_TRUNC('month', COALESCE(s.share_at, d.created_at))";
        break;
      case 'year':
        dateFormat = "TO_CHAR(DATE_TRUNC('year', COALESCE(s.share_at, d.created_at)), 'YYYY-MM-DD')";
        interval = "10 years";
        groupBy = "DATE_TRUNC('year', COALESCE(s.share_at, d.created_at))";
        break;
    }

    try {
        const result: any[] = await prisma.$queryRawUnsafe(`
            SELECT ${dateFormat} as date, COUNT(*) as count
            FROM shares s
            JOIN documents d ON s.id_doc = d.id
            WHERE COALESCE(s.share_at, d.created_at) >= NOW() - INTERVAL '${interval}'
            GROUP BY ${groupBy}
            ORDER BY date ASC
        `);
        return result.map(r => ({ date: r.date, count: Number(r.count) }));
    } catch (e) {
        return [];
    }
}

// --- Actions ---

export async function getAdminStatsAction(type?: 'users' | 'documents' | 'shares', period: 'day' | 'week' | 'month' | 'year' = 'week') {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) {
      return { success: false, error: "Access denied" };
    }

    if (!process.env.DATABASE_URL) {
      // Simulation fallback if needed, but assuming DB is present based on prisma usage
      return { success: true, stats: {} };
    }

    // Specific type grouping
    if (type && ['users', 'documents', 'shares'].includes(type)) {
      let groupedData: Array<{ date: string; count: number }> = [];
      if (type === 'users') groupedData = await getUsersGroupedByPeriod(period);
      else if (type === 'documents') groupedData = await getDocumentsGroupedByPeriod(period);
      else if (type === 'shares') groupedData = await getSharesGroupedByPeriod(period);

      return { success: true, data: groupedData, period, type };
    }

    // General Stats
    // Using javascript Date calculation for "since" counts
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalUsers,
      totalDocuments,
      totalShares,
      usersLast7Days,
      usersLast30Days,
      documentsLast7Days,
      documentsLast30Days,
      sharesLast7Days,
      sharesLast30Days,
      verifiedUsers,
      bannedUsers,
      adminUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.document.count(),
      prisma.share.count(),
      prisma.user.count({ where: { created_at: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
      prisma.document.count({ where: { created_at: { gte: sevenDaysAgo } } }),
      prisma.document.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
      prisma.share.count({ where: { share_at: { gte: sevenDaysAgo } } }), 
      // Note: simple share_at check. To replicate COALESCE logic in Prisma count is hard.
      // We accept slight inaccuracy if share_at is null for old shares, OR we strictly use share_at if schema defaults it to now().
      prisma.share.count({ where: { share_at: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { email_verified: true } }),
      prisma.user.count({ where: { is_banned: true } }),
      prisma.user.count({ where: { is_admin: true } }),
    ]);

    return {
      success: true,
      stats: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          banned: bannedUsers,
          admins: adminUsers,
          last7Days: usersLast7Days,
          last30Days: usersLast30Days,
        },
        documents: {
          total: totalDocuments,
          last7Days: documentsLast7Days,
          last30Days: documentsLast30Days,
        },
        shares: {
          total: totalShares,
          last7Days: sharesLast7Days,
          last30Days: sharesLast30Days,
        },
      },
    };
  } catch (error) {
    console.error("❌ Error retrieving statistics:", error);
    return { success: false, error: "Error retrieving statistics" };
  }
}

export async function getAdminUsersAction() {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };

    if (!process.env.DATABASE_URL) return { success: true, users: [] };

    const users = await prisma.user.findMany({
        orderBy: { created_at: "desc" }
    });
    
    // Convert Dates to be safe for server components serialization if needed, 
    // but Server Actions return JSON, so Dates are serialized as ISO strings.
    return { success: true, users };
  } catch (error) {
    console.error("❌ Error retrieving users:", error);
    return { success: false, error: "Error retrieving users" };
  }
}

export async function updateAdminUserAction(userId: number, action: 'toggle_ban' | 'toggle_admin') {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };

    if (!process.env.DATABASE_URL) return { success: true, message: "Simulated" };

    if (isNaN(userId)) return { success: false, error: "Invalid ID" };

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, error: "User not found" };

    let updated;
    if (action === 'toggle_ban') {
        const newStatus = !user.is_banned;
        updated = await prisma.user.update({
            where: { id: userId },
            data: { is_banned: newStatus }
        });
        
        // Notification
        if (newStatus) {
            await emailService.sendBanNotificationEmail(user.email, user.first_name || "User");
        } else {
            await emailService.sendUnbanNotificationEmail(user.email, user.first_name || "User");
        }
    } else if (action === 'toggle_admin') {
        updated = await prisma.user.update({
            where: { id: userId },
            data: { is_admin: !user.is_admin }
        });
    }

    return { success: true, message: "Updated" };
  } catch (error) {
    console.error("❌ Error updating user:", error);
    return { success: false, error: "Error updating user" };
  }
}

export async function getAdminRequestsAction(limit: number = 100, offset: number = 0) {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };

    if (!process.env.DATABASE_URL) return { success: true, requests: [] };

    const requests = await prisma.userRequest.findMany({
        take: limit,
        skip: offset,
        orderBy: { created_at: "desc" },
        include: {
            user: { select: { email: true, first_name: true, last_name: true } },
            validator: { select: { email: true, first_name: true, last_name: true } }
        }
    });

    // Map to legacy format expected by frontend
    const mapped = requests.map(r => ({
        ...r,
        user_email: r.user.email,
        user_name: `${r.user.first_name||''} ${r.user.last_name||''}`.trim(),
        validator_email: r.validator?.email || "",
        validator_name: r.validator ? `${r.validator.first_name||''} ${r.validator.last_name||''}`.trim() : "",
        user: undefined,
        validator: undefined
    }));

    return { success: true, requests: mapped };
  } catch (error) {
    console.error("❌ Error retrieving requests:", error);
    return { success: false, error: "Error retrieving requests" };
  }
}

export async function handleAdminRequestAction(requestId: number, action: 'validate' | 'reject' | 'resolve' | 'delete', data?: any) {
  try {
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id ? Number(session.user.id) : null;
    
    // Admin check based on current user loaded from DB to be safe or session claim
    // For now assuming checkAdminAccess handles it
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };

    if (!process.env.DATABASE_URL) return { success: true };

    if (action === 'delete') {
        await prisma.userRequest.delete({ where: { id: requestId } });
        return { success: true };
    }

    const updateData: any = {};
    if (action === 'validate') {
      updateData.validated = true;
      updateData.validated_by = currentUserId;
      updateData.validated_at = new Date();
      updateData.status = 'in_progress';
    } else if (action === 'reject') {
      updateData.status = 'rejected';
      updateData.validated = false;
    } else if (action === 'resolve') {
      updateData.status = 'resolved';
    }

    await prisma.userRequest.update({
        where: { id: requestId },
        data: updateData
    });

    return { success: true };
  } catch (error) {
    console.error("❌ Error handling request:", error);
    return { success: false, error: "Error handling request" };
  }
}

export async function getAdminSettingsAction() {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };

    if (!process.env.DATABASE_URL) return { success: true, settings: {} };

    const settings = await prisma.appSetting.findMany({
        orderBy: { key: "asc" }
    });

    const settingsMap: Record<string, string> = {};
    const sensitiveKeys = new Set(["ollama_token"]);
    
    for (const setting of settings) {
      if (sensitiveKeys.has(setting.key)) {
        settingsMap[setting.key] = setting.value ? "***" : "";
      } else {
        settingsMap[setting.key] = setting.value;
      }
    }

    return { success: true, settings: settingsMap };
  } catch (error) {
    console.error("❌ Error retrieving settings:", error);
    return { success: false, error: "Error retrieving settings" };
  }
}

export async function updateAdminSettingsAction(key: string, value: string, description?: string) {
  try {
    const isAdmin = await checkAdminAccess();
    if (!isAdmin) return { success: false, error: "Access denied" };
    if (!key) return { success: false, error: "Invalid key" };

    if (!process.env.DATABASE_URL) return { success: true };

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: {
        value,
        ...(description ? { description } : {}),
      },
      create: {
        key,
        value,
        description: description || null,
      },
    });

    return { success: true, setting };
  } catch (error) {
    console.error("❌ Error updating settings:", error);
    return { success: false, error: "Error updating settings" };
  }
}

export async function promoteSelfAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.email) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return { success: false, error: "User not found" };

    await prisma.user.update({
        where: { id: user.id },
        data: { is_admin: true }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Internal server error" };
  }
}

export async function updateRequestStatusAction(requestId: number, status: string, message?: string) {
    try {
        const isAdmin = await checkAdminAccess();
        if (!isAdmin) return { success: false, error: "Access denied" };

        await prisma.userRequest.update({
            where: { id: requestId },
            data: { status }
        });
        return { success: true };
    } catch(e) {
        return { success: false, error: "Error" };
    }
}
