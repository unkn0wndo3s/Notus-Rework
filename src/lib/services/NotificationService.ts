import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserService } from "./UserService";

export class NotificationService {
    private notificationRepository: NotificationRepository;
    private userService: UserService;

    constructor() {
        this.notificationRepository = new NotificationRepository();
        this.userService = new UserService();
    }

    async initializeTables(): Promise<void> {
        await this.notificationRepository.initializeTables();
    }

    async sendNotification(id_sender: number | null, id_receiver: number, message: object | string) {
        if (!process.env.DATABASE_URL) {
            return { success: true };
        }

        try {
            await this.notificationRepository.initializeTables();
            return await this.notificationRepository.createNotification(id_sender, id_receiver, message);
        } catch (error) {
            console.error("❌ Error sendNotification:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async getNotificationsForUser(id_receiver: number, limit = 50, offset = 0, onlyUnread = false): Promise<{ success: boolean; data?: any[]; error?: string }> {
        try {
            const res = await this.notificationRepository.getUserNotifications(id_receiver, limit, offset, onlyUnread) as { success: boolean; data?: any[]; error?: string };
            if (!res.success) return res;

            const rows = Array.isArray(res.data) ? res.data as any[] : [];
            const normalized = rows.map(r => {
                try {
                    if (r.message && typeof r.message === 'object') r.message = JSON.stringify(r.message);
                } catch (_) {}

                let parsed: any = null;
                try { parsed = JSON.parse(r.message); } catch (_) { parsed = null; }
                const avatar = parsed?.avatar || r.sender_avatar || r.avatar || null;

                return {
                    ...r,
                    message: typeof r.message === 'string' ? r.message : String(r.message || ''),
                    parsed: parsed ?? null,
                    avatar
                };
            });

            const idsToResolve = Array.from(new Set(normalized
                .filter((x: any) => !x.avatar && x.id_sender != null)
                .map((x: any) => x.id_sender as number)
            )) as number[];

            if (idsToResolve.length > 0) {
                const avatarById: Record<number, string | null> = {};
                for (const id of idsToResolve) {
                    try {
                        const uRes = await this.userService.getUserById(id);
                        if (uRes.success && uRes.user && uRes.user.profile_image) {
                            avatarById[id] = uRes.user.profile_image as string;
                        } else {
                            avatarById[id] = null;
                        }
                    } catch (_e) {
                        avatarById[id] = null;
                    }
                }

                for (const row of normalized) {
                    if (!row.avatar && row.id_sender != null) {
                        const found = avatarById[row.id_sender as number];
                        if (found) row.avatar = found;
                    }
                }
            }

            return { success: true, data: normalized };
        } catch (error) {
            console.error("❌ Error getNotificationsForUser:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async markNotificationAsRead(notificationId: number) {
        try {
            return await this.notificationRepository.markAsRead(notificationId);
        } catch (error) {
            console.error("❌ Error markNotificationAsRead:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async markAllAsRead(id_receiver: number) {
        try {
            return await this.notificationRepository.markAllAsRead(id_receiver);
        } catch (error) {
            console.error("❌ Error markAllAsRead:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async deleteNotification(notificationId: number) {
        try {
            return await this.notificationRepository.deleteNotification(notificationId);
        } catch (error) {
            console.error("❌ Error deleteNotification:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async sendPasswordChangeNotification(id_receiver: number) {
        const messageText = "Your password has been changed.";
        try {
            return await this.notificationRepository.createNotification(null, id_receiver, messageText);
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async getUnreadCount(id_receiver: number) {
        try {
            return await this.notificationRepository.countUnread(id_receiver);
        } catch (error) {
            console.error("❌ Error getUnreadCount:", error);
            return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
        }
    }
}