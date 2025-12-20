import { RequestService } from "@/lib/services/RequestService";
import { Card } from "@/components/ui";
import RequestDetailPageClient from "@/components/admin/RequestDetailPageClient";
import { notFound } from "next/navigation";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export default async function RequestDetailPage({ params }: RouteParams) {
  const { id } = await params;
  const requestService = new RequestService();
  await requestService.initializeTables();

  const requestResult = await requestService.getRequestById(parseInt(id));

  if (!requestResult.success || !requestResult.request) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <header className="text-center pt-10">
        <h1 className="text-3xl font-bold text-foreground">
          Request Details #{requestResult.request.id}
        </h1>
        <p className="mt-2 text-muted-foreground">
          View request information and respond to the user
        </p>
      </header>

      <section className="max-w-4xl mx-auto">
        <Card className="bg-background">
          <Card.Content className="p-6">
            <RequestDetailPageClient request={requestResult.request} />
          </Card.Content>
        </Card>
      </section>
    </main>
  );
}

