"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Textarea } from "@/components/ui";
import Icon from "@/components/Icon";
import ViewModeSwitch from "@/components/support/ViewModeSwitch";
import RequestHistoryCard from "@/components/support/RequestHistoryCard";
import { cn } from "@/lib/utils";
import type { Request } from "@/lib/repositories/RequestRepository";
import { getRequestsAction, createRequestAction } from "@/actions/requestActions";
import { getNotifications } from "@/actions/notificationActions";

type RequestType = "help" | "data_restoration" | "other";
type ViewMode = "new" | "history";

interface RequestWithMessage extends Request {
  message?: string;
}

const typeLabels: Record<RequestType, string> = {
  help: "Help request",
  data_restoration: "Data restoration",
  other: "Other",
};

const statusLabels: Record<Request["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const statusVariants: Record<Request["status"], "warning" | "info" | "success" | "destructive"> = {
  pending: "warning",
  in_progress: "info",
  resolved: "success",
  rejected: "destructive",
};

export default function SupportPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // If param "view" is "history", open in history mode
    return searchParams?.get("view") === "history" ? "history" : "new";
  });
  const [type, setType] = useState<RequestType>("help");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requests, setRequests] = useState<RequestWithMessage[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);



  const fetchUserRequests = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoadingRequests(true);
    setError(null);

    try {
        const [requestsResult, notificationsResult] = await Promise.all([
          getRequestsAction({ userId: Number(session.user.id) }),
          getNotifications(Number(session.user.id)),
        ]);

        if (!requestsResult.success) {
          throw new Error(requestsResult.error || "Error retrieving requests");
        }

        const requestsList = requestsResult.data?.requests || [];
        // Notification action returns structure { success, notifications: ... } or { success, data: ... } depending on implementation.
        // Checking notificationActions.ts: getNotifications returns "result" which is { success: true, notifications: [...] } from service.

        const notificationsList = (notificationsResult as any).notifications || (notificationsResult as any).data || [];

        const userRequests: RequestWithMessage[] = requestsList.map((req: Request) => {
          // Find message in notifications
          const notification = notificationsList.find(
            (notif: any) => {
              try {
                const parsed = notif.parsed || (typeof notif.message === "string" ? JSON.parse(notif.message) : null);
                return (
                  parsed &&
                  (parsed.type === "request-response" || parsed.type === "request-resolved") &&
                  parsed.requestId === req.id
                );
              } catch {
                return false;
              }
            }
          );

          let message: string | undefined;
          if (notification) {
            try {
              const parsed = notification.parsed || (typeof notification.message === "string" ? JSON.parse(notification.message) : null);
              message = parsed?.message || (typeof notification.message === "string" ? notification.message : undefined);
            } catch {
              message = typeof notification.message === "string" ? notification.message : undefined;
            }
          }

          return { ...req, message };
        }); 

        setRequests(userRequests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (viewMode === "history" && session?.user?.id) {
      fetchUserRequests();
    }
  }, [viewMode, session?.user?.id, fetchUserRequests]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await createRequestAction({
        type,
        title: title.trim(),
        description: description.trim(),
      });

      if (!response.success) {
        throw new Error(response.error || "Error creating request");
      }

      setSuccess(true);
      setTitle("");
      setDescription("");
      setType("help");

      setTimeout(() => {
        setSuccess(false);
      }, 5000);

      // Refresh requests if in history mode
      if (viewMode === "history") {
        await fetchUserRequests();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeOptions: { value: RequestType; label: string; description: string; icon: string }[] = [
    {
      value: "help",
      label: "Help request",
      description: "Need help using the application",
      icon: "alert",
    },
    {
      value: "data_restoration",
      label: "Data restoration",
      description: "Recover lost or deleted data",
      icon: "document",
    },
    {
      value: "other",
      label: "Other",
      description: "Other type of request (Please specify in the title)",
      icon: "gear",
    },
  ];

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="md">
        <section className="space-y-6">
          <header>
            <h1 className="font-title text-4xl font-regular text-foreground hidden md:block">
              Support
            </h1>
            <p className="mt-2 text-muted-foreground">
              Create a request to get help or ask for data restoration.
            </p>
          </header>

          <ViewModeSwitch value={viewMode} onChange={setViewMode} />

          {success && (
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg text-success">
              <div className="flex items-center gap-2">
                <Icon name="circleCheck" className="w-5 h-5" />
                <p className="font-medium">Your request has been created successfully!</p>
              </div>
              <p className="text-sm mt-1">
                An administrator will review your request and reply shortly.
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <div className="flex items-center gap-2">
                <Icon name="alert" className="w-5 h-5" />
                <p className="font-medium">Error</p>
              </div>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {viewMode === "new" ? (
            <Card>
              <CardHeader>
                <CardTitle>New request</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset>
                  <legend className="text-foreground font-medium mb-3">
                    Request type
                  </legend>
                  <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
                    {typeOptions.map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors",
                          "lg:flex-col lg:items-center lg:text-center lg:gap-4 lg:min-h-[160px]",
                          type === option.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={option.value}
                          checked={type === option.value}
                          onChange={(e) => setType(e.target.value as RequestType)}
                          className="mt-1 lg:mt-0 lg:order-3"
                          aria-label={option.label}
                        />
                        <div className="flex-1 lg:flex lg:flex-col lg:items-center lg:gap-2 lg:flex-1">
                          <div className="flex items-center gap-2 mb-1 lg:flex-col lg:mb-0">
                            <Icon name={option.icon as any} className="w-5 h-5 md:w-8 md:h-8 text-foreground" />
                            <span className="font-medium text-foreground">{option.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground lg:text-center">{option.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="title" className="block text-foreground font-medium mb-2">
                    Request title
                  </label>
                  <Input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Connection issue"
                    required
                    maxLength={255}
                    className="bg-card text-foreground border-border"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-foreground font-medium mb-2">
                    Detailed description
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="The more details you provide, the faster we can help you."
                    required
                    rows={6}
                    className="bg-card text-foreground border-border resize-none"
                  />

                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !title.trim() || !description.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Icon name="spinner" className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Icon name="check" className="w-4 h-4 mr-2" />
                        Send request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>My support requests</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingRequests && (
                  <div className="flex items-center justify-center py-8">
                    <Icon name="spinner" className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading...</span>
                  </div>
                )}
                {!isLoadingRequests && requests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Icon name="inbox" className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No support requests yet.</p>
                  </div>
                )}
                {!isLoadingRequests && requests.length > 0 && (
                  <div className="space-y-4">
                    {requests.map((req) => (
                      <RequestHistoryCard
                        key={req.id}
                        request={req}
                        typeLabels={typeLabels}
                        statusLabels={statusLabels}
                        statusVariants={statusVariants}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </ContentWrapper>
    </main>
  );
}
