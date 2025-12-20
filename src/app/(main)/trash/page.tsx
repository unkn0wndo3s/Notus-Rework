import { getServerSession } from "next-auth/next";
import { authOptions } from "@/../lib/auth";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Card, CardContent, CardHeader, CardTitle, Button, Alert } from "@/components/ui";
import { getUserTrashDocumentsAction, restoreTrashedDocumentFormAction } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function TrashPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  const userId = session?.user?.id ? parseInt(String(session.user.id)) : undefined;

  const trashedResult = await getUserTrashDocumentsAction(userId!);

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="lg">
        <section className="space-y-6">
          <header>
            <h1 className="font-title text-4xl font-regular text-foreground hidden md:block">
              Trash
            </h1>
          </header>

          {!trashedResult.success && session?.user && (
            <Alert variant="error">
              <Alert.Description>
                Error loading trash: {trashedResult.error}
              </Alert.Description>
            </Alert>
          )}

          <section className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {(Array.isArray(trashedResult.documents) ? trashedResult.documents : []).map((t: any) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="truncate">{t.title || "Untitled"}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Deleted on {t.deleted_at ? new Date(t.deleted_at).toLocaleDateString("en-US") : ""}
                  </div>
                  <form action={restoreTrashedDocumentFormAction}>
                    <input type="hidden" name="trashId" value={String(t.id)} />
                    <Button type="submit" variant="default">Restore</Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </section>

          {trashedResult.success && (!trashedResult.documents || trashedResult.documents.length === 0) && (
            <div className="text-center py-10 text-muted-foreground">
              No notes in trash.
            </div>
          )}
        </section>
      </ContentWrapper>
    </main>
  );
}
