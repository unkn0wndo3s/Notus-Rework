import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { getUserDocumentsAction, fetchSharedDocumentsAction } from "@/actions/documentActions";
import Navigation from "@/components/navigation/Navigation";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Button, Card, Alert, LoadingSpinner, Logo } from "@/components/ui";
import { SearchableDocumentsList } from "@/components/documents/SearchableDocumentsList";

export default async function AppHome() {
  const session = await getServerSession(authOptions);

  // Fetch documents only if user is logged in
  const userDocumentsResult = session?.user?.id
    ? await getUserDocumentsAction(parseInt(session.user.id))
    : { success: true, documents: [] };

  const sharedDocumentsResult = session?.user?.email
    ? await fetchSharedDocumentsAction()
    : { success: true, documents: [] };

  // Combine documents avoiding duplicates
  const userDocuments = userDocumentsResult.success && Array.isArray(userDocumentsResult.documents)
    ? userDocumentsResult.documents
    : [];
  
  const sharedDocuments = sharedDocumentsResult.success && Array.isArray(sharedDocumentsResult.documents)
    ? sharedDocumentsResult.documents
    : [];

  // Create a Set of user document IDs to avoid duplicates
  const userDocumentIds = new Set(userDocuments.map(d => d.id));
  
  // Filter shared documents to keep only those NOT already in user's documents
  const uniqueSharedDocuments = sharedDocuments.filter((d: any) => !userDocumentIds.has(d.id));

  const allDocuments = [
    ...userDocuments,
    ...uniqueSharedDocuments,
  ].map((d: any) => ({
    ...d,
    id: String(d.id),
    user_id: d.user_id != null ? String(d.user_id) : undefined,
  }));

  const documentsResult = {
    success: userDocumentsResult.success && sharedDocumentsResult.success,
    documents: allDocuments,
    error: !userDocumentsResult.success
      ? userDocumentsResult.error
      : !sharedDocumentsResult.success
      ? sharedDocumentsResult.error
      : undefined,
  };

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="lg">
        <section className="space-y-6">
          <header>
            <h1 className="font-title text-4xl font-regular text-foreground hidden md:block">
              My notes
            </h1>
          </header>

          {!documentsResult.success && session?.user && (
            <Alert variant="error">
              <Alert.Description>
                Error loading documents: {documentsResult.error}
              </Alert.Description>
            </Alert>
          )}

          <SearchableDocumentsList
            documents={
              documentsResult.success && Array.isArray(documentsResult.documents)
                ? (documentsResult.documents as any[]).map((d) => ({
                    ...d,
                    id: String(d.id),
                    user_id: d.user_id != null ? String(d.user_id) : undefined,
                  }))
                : []
            }
            currentUserId={session?.user?.id ? String(session.user.id) : undefined}
            error={!documentsResult.success ? documentsResult.error : undefined}
          />
        </section>
      </ContentWrapper>
    </main>
  );
}
