"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";
import Icon from "@/components/Icon";
import { cn } from "@/lib/utils";
import type { Request } from "@/lib/repositories/RequestRepository";

interface RequestWithMessage extends Request {
  message?: string;
}

interface RequestHistoryCardProps {
  request: RequestWithMessage;
  typeLabels: Record<Request["type"], string>;
  statusLabels: Record<Request["status"], string>;
  statusVariants: Record<Request["status"], "warning" | "info" | "success" | "destructive">;
  formatDate: (date: Date | string) => string;
}

export default function RequestHistoryCard({
  request,
  typeLabels,
  statusLabels,
  statusVariants,
  formatDate,
}: RequestHistoryCardProps) {
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);

  // Extract only the custom message, removing status change mention
  const getCustomMessage = (message: string): string | null => {
    // If message contains "\n\n", take only the part after (custom message)
    if (message.includes("\n\n")) {
      const parts = message.split("\n\n");
      const customMessage = parts.slice(1).join("\n\n").trim();
      return customMessage || null;
    }
    
    // If message starts with "The status of your request" or "Your request", 
    // it is just a status change without custom message
    if (
      message.startsWith("The status of your request") ||
      message.startsWith("Your request") ||
      message.startsWith("mise à jour") || // Legacy French match
      message.startsWith("Update on your request") ||
      message.startsWith("Request update")
    ) {
      return null;
    }
    
    // Otherwise, it is a custom message without status change text
    return message.trim() || null;
  };

  const customMessage = request.message ? getCustomMessage(request.message) : null;

  return (
    <article className="p-4 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={cn("font-medium text-foreground mb-1 break-words")}>{request.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariants[request.status]}>
              {statusLabels[request.status]}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {typeLabels[request.type]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(request.created_at)}
            </span>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground mb-1">Description:</p>
          <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap break-words")}>
            {request.description}
          </p>
        </div>
        {customMessage && (
          <div className="mt-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsResponseExpanded(!isResponseExpanded)}
              className="flex items-center gap-2 w-full text-left"
              aria-expanded={isResponseExpanded}
            >
              <p className="text-sm font-medium text-foreground">Response:</p>
              <Icon
                name="chevronDown"
                className={cn(
                  "w-4 h-4 transition-transform text-muted-foreground",
                  isResponseExpanded && "transform rotate-180"
                )}
              />
            </button>
            {isResponseExpanded && (
              <p className={cn("text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded border border-border mt-2 break-words")}>
                {customMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
