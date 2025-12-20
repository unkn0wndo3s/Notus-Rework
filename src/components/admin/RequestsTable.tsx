"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import type { Request } from "@/lib/repositories/RequestRepository";

interface RequestsTableProps {
  requests: Request[];
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

export default function RequestsTable({ requests }: RequestsTableProps) {
  const router = useRouter();


  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-background">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-background divide-y divide-border">
          {requests.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                No requests found
              </td>
            </tr>
          ) : (
            requests.map((request) => (
              <Fragment key={request.id}>
                <tr
                  onClick={() => router.push(`/admin/requests/${request.id}`)}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/admin/requests/${request.id}`);
                    }
                  }}
                  aria-label={`View details of request ${request.id}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {typeLabels[request.type]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    <div>
                      <div className="font-medium">{request.user_name || "N/A"}</div>
                      <div className="text-muted-foreground text-xs">{request.user_email || ""}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={statusVariants[request.status]} size="sm">
                      {statusLabels[request.status]}
                    </Badge>
                  </td>
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

