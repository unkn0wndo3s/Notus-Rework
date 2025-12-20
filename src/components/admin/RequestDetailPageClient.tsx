"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui";
import Icon from "@/components/Icon";
import { Badge } from "@/components/ui";
import type { Request } from "@/lib/repositories/RequestRepository";
import { cn } from "@/lib/utils";

interface RequestDetailPageClientProps {
  request: Request;
}

const typeLabels: Record<Request["type"], string> = {
  help: "Help Request",
  data_restoration: "Data Restoration",
  other: "Other",
};

const statusLabels: Record<Request["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const statusVariants: Record<Request["status"], "warning" | "info" | "success" | "destructive"> = {
  pending: "warning",
  in_progress: "info",
  resolved: "success",
  rejected: "destructive",
};

export default function RequestDetailPageClient({ request: initialRequest }: RequestDetailPageClientProps) {
  const router = useRouter();
  const [request, setRequest] = useState(initialRequest);
  const [message, setMessage] = useState("");
  const [showMessageField, setShowMessageField] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState(false);
  const [messageSent, setMessageSent] = useState(false);

  const handleStatusChange = async (newStatus: Request["status"]) => {
    if (newStatus === request.status && !message.trim()) return;

    setError(null);
    setIsUpdatingStatus(true);

    try {
      const body: { status: string; message?: string } = {
        status: newStatus,
      };

      if (showMessageField && message.trim()) {
        body.message = message.trim();
      }

      const response = await fetch(`/api/admin/requests/${request.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Error during status update");
      }

      setRequest(data.request);
      setStatusUpdateSuccess(true);
      const hadMessage = !!(showMessageField && message.trim());
      setMessageSent(hadMessage);
      setMessage("");
      setShowMessageField(false);
      setTimeout(() => {
        setStatusUpdateSuccess(false);
        setMessageSent(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <article className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("flex-1 min-w-0")}>
          <div className="flex items-center gap-3 mb-3">
            <Button
              type="button"
              variant="ghostPurple"
              onClick={() => router.push("/admin/requests")}
              className="flex items-center gap-2 px-4"
            >
              <Icon name="arrowLeft" className="w-4 h-4" />
              Back
            </Button>
          </div>
          <h2 className={cn("text-2xl font-semibold text-foreground mb-2 break-words")}>{request.title}</h2>
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={statusVariants[request.status]} size="sm">
              {statusLabels[request.status]}
            </Badge>
            <Badge variant="outline" size="sm">
              {typeLabels[request.type]}
            </Badge>
          </div>
        </div>
      </div>

      {statusUpdateSuccess && (
        <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm">
          <div className="flex items-center gap-2">
            <Icon name="circleCheck" className="w-4 h-4" />
            <span>
              {messageSent
                ? "Status updated and message sent successfully!"
                : "Status updated successfully!"}
            </span>
          </div>
        </div>
      )}

<dl className="space-y-4">
        <div>
          <dt className="text-sm font-medium text-muted-foreground mb-1">User</dt>
          <dd className="text-sm text-foreground">
            {request.user_name || "N/A"} ({request.user_email || "N/A"})
          </dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-muted-foreground mb-1">Creation Date</dt>
          <dd className="text-sm text-foreground">
            {new Date(request.created_at).toLocaleDateString("en-US", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </dd>
        </div>

        {request.validated && request.validator_name && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground mb-1">Validated by</dt>
            <dd className="text-sm text-foreground">
              {request.validator_name} ({request.validator_email})
              {request.validated_at && (
                <span className="text-muted-foreground ml-2">
                  on {new Date(request.validated_at).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-sm font-medium text-muted-foreground mb-1">Description</dt>
          <dd className={cn("text-sm text-foreground whitespace-pre-wrap bg-muted/30 p-4 rounded-lg break-words")}>
            {request.description}
          </dd>
        </div>
      </dl>
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <div className="flex items-center gap-2">
            <Icon name="alert" className="w-4 h-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <section className="border border-border rounded-lg p-4 bg-card">
        <h3 className="text-lg font-semibold text-foreground mb-4">Modify Status</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label htmlFor="status-select" className="text-sm font-medium text-foreground">
              Request Status
            </label>
            <Select
              value={request.status}
              onValueChange={(value) => handleStatusChange(value as Request["status"])}
              disabled={isUpdatingStatus}
            >
              <SelectTrigger id="status-select" className="w-48" aria-label="Choose status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            {isUpdatingStatus && (
              <Icon name="spinner" className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMessageField(!showMessageField)}
              className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
              aria-label={showMessageField ? "Hide message field" : "Show message field"}
            >
              {showMessageField ? (
                <>
                  <Icon name="minus" className="w-4 h-4" />
                  <span>Hide message</span>
                </>
              ) : (
                <>
                  <Icon name="plus" className="w-4 h-4" />
                  <span>Add a message (optional)</span>
                </>
              )}
            </button>
          </div>

          {showMessageField && (
            <div className="mt-4">
              <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                Message to user
              </label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message to the user (optional)..."
                rows={6}
                className="bg-card text-foreground border-border resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This message will be sent as a notification to the user when the status is updated.
              </p>
            </div>
          )}
        </div>
      </section>
    </article>
  );
}

