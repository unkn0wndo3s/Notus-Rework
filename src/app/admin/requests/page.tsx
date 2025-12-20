import { RequestService } from "@/lib/services/RequestService";
import { Card } from "@/components/ui";
import RequestsTable from "@/components/admin/RequestsTable";
import type { Request } from "@/lib/repositories/RequestRepository";

export default async function AdminRequestsPage() {
  const requestService = new RequestService();
  await requestService.initializeTables();
  const requestsResult = await requestService.getAllRequests(100, 0);
  const requests: Request[] = requestsResult.success && requestsResult.requests ? requestsResult.requests : [];

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
  const resolvedCount = requests.filter((r) => r.status === "resolved").length;

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          User Request Management
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage help requests and data restoration requests from users.
        </p>
      </header>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Header>
            <div className="flex items-center justify-between">
              <Card.Title className="text-foreground text-2xl font-semibold">
                Request List ({requests.length})
              </Card.Title>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-sm text-muted-foreground">In Progress</div>
                <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Resolved</div>
                <div className="text-2xl font-bold text-green-600">{resolvedCount}</div>
              </div>
            </div>
            <RequestsTable requests={requests} />
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}

