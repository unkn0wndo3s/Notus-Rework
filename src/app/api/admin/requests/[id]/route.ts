import { NextResponse } from "next/server";
import { UserService } from "@/lib/services/UserService";
import { RequestService } from "@/lib/services/RequestService";
import { NotificationService } from "@/lib/services/NotificationService";
import { UpdateRequestData } from "@/lib/repositories/RequestRepository";
import { requireAdmin } from "@/lib/security/routeGuards";

const requestService = new RequestService();
const userService = new UserService();
const notificationService = new NotificationService();

const REQUEST_STATUSES = ["pending", "in_progress", "resolved", "rejected"] as const;
type RequestStatus = (typeof REQUEST_STATUSES)[number];

function isValidRequestStatus(status: unknown): status is RequestStatus {
  return typeof status === "string" && REQUEST_STATUSES.includes(status as RequestStatus);
}

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }

    const { id } = await params;
    await requestService.initializeTables();

    const result = await requestService.getRequestById(Number.parseInt(id));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    console.error("❌ Error retrieving request:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }

    const { id } = await params;
    const body = await request.json();
    const { status, message } = body;
    await requestService.initializeTables();
    await notificationService.initializeTables();

    const requestBeforeUpdate = await requestService.getRequestById(Number.parseInt(id));
    if (!requestBeforeUpdate.success || !requestBeforeUpdate.request) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 404 }
      );
    }

    const oldStatus = requestBeforeUpdate.request.status;
    const newStatus: "pending" | "in_progress" | "resolved" | "rejected" | undefined = 
      status && ["pending", "in_progress", "resolved", "rejected"].includes(status)
        ? (status as "pending" | "in_progress" | "resolved" | "rejected")
        : undefined;

    // Update the request
    const updateData: UpdateRequestData = {};
    if (status !== undefined) {
      if (!isValidRequestStatus(status)) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    const result = await requestService.updateRequest(Number.parseInt(id), updateData);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 500 }
      );
    }

    // Send a notification if status changed or a message is provided
    const statusChanged = !!(newStatus && String(newStatus) !== String(oldStatus));
    const hasMessage = !!(message && typeof message === "string" && message.trim());
    
    if ((statusChanged || hasMessage) && result.request) {
      await sendRequestUpdateNotification(
        adminResult.userId,
        result.request as unknown as RequestWithDetails,
        newStatus,
        statusChanged,
        hasMessage ? message.trim() : undefined
      );
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    console.error("❌ Error updating request:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

interface RequestWithDetails {
  id: number;
  title: string;
  type: string;
  status: RequestStatus;
  user_id: number;
}

async function sendRequestUpdateNotification(
  adminId: number,
  request: RequestWithDetails,
  newStatus: RequestStatus | undefined,
  statusChanged: boolean,
  message?: string
) {
  const typeLabels: Record<string, string> = {
    help: "Help request",
    data_restoration: "Data restoration",
    other: "Other",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending",
    in_progress: "In progress",
    resolved: "Resolved",
    rejected: "Rejected",
  };

  const statusLabel = newStatus ? (statusLabels[newStatus] || newStatus) : "update";
  let notificationMessageText = `Update for your request "${request.title}".`;
  
  if (statusChanged) {
    notificationMessageText = `The status of your request "${request.title}" has been modified: ${statusLabel}.`;
    if (message) {
      notificationMessageText = `${notificationMessageText}\n\n${message}`;
    } else if (newStatus === "resolved") {
      notificationMessageText = `Your request "${request.title}" has been resolved.`;
    }
  } else if (message) {
    notificationMessageText = message;
  }

  const notificationType = statusChanged && newStatus === "resolved" ? "request-resolved" : "request-response";

  const notificationContent = {
    type: notificationType,
    requestId: request.id,
    requestTitle: request.title,
    requestType: request.type,
    requestTypeLabel: typeLabels[request.type] || "Other",
    status: newStatus || request.status,
    message: notificationMessageText,
    from: "Administration",
  };

  const result = await notificationService.sendNotification(adminId, request.user_id, notificationContent);

  if (!result.success) {
    const errorMessage = 'error' in result ? result.error : "Unknown error";
    console.error("❌ Error sending notification:", errorMessage);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) {
      return adminResult;
    }

    const { id } = await params;
    await requestService.initializeTables();

    const result = await requestService.deleteRequest(Number.parseInt(id));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting request:", error);
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 500 }
    );
  }
}

