import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import { Alert } from "@/components/ui";
import { SearchableDocumentsList } from "@/components/documents/SearchableDocumentsList";
import { getFavoritesAction } from "@/actions/documentActions";
import { redirect } from "next/navigation";

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const favoritesResult = await getFavoritesAction();

  const normalizedDocuments = (favoritesResult.success ? favoritesResult.documents || [] : []).map((d: any) => ({
    ...d,
    id: String(d.id),
    user_id: d.user_id != null ? String(d.user_id) : undefined,
  }));

  const listError = favoritesResult.success ? undefined : (favoritesResult.error || undefined);

  return (
    <main className="min-h-screen bg-background">
      <NavBar />
      <ContentWrapper maxWidth="lg">
        <section className="space-y-8">
          <header>
            <h1 className="font-title text-4xl font-regular text-foreground hidden md:block">
              Favorites
            </h1>
          </header>

          {!favoritesResult.success && session?.user && (
            <Alert variant="error">
              <Alert.Description>
                Error loading favorites: {favoritesResult.error}
              </Alert.Description>
            </Alert>
          )}

          <SearchableDocumentsList
            documents={normalizedDocuments}
            currentUserId={session?.user?.id ? String(session.user.id) : undefined}
            error={listError}
            isFavoritesList
          />
        </section>
      </ContentWrapper>
    </main>
  );
}


