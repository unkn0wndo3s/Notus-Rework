import { auth } from "@/../auth";
import NavBar from "@/components/navigation/NavBar";
import ContentWrapper from "@/components/common/ContentWrapper";
import Image  from "next/image";
import { Card, Button, BackHeader } from "@/components/ui";
import DocumentCard from "@/components/documents/DocumentCard";
import { getUserDocumentsAction, getUserProfileAction } from "@/lib/actions";
import Link from "next/link";
import ProfileEditButton from "./ProfileEditButton";
import Icon from "@/components/Icon";

export default async function ProfilePage() {
  const session = await auth();

  const userId = session?.user?.id ? Number(session.user.id) : undefined;

  // Fetch complete user profile data
  const profileResult = userId
    ? await getUserProfileAction(userId)
    : { success: true, user: null };

  const userProfile = profileResult.success ? profileResult.user : null;
  const username =
    userProfile?.username ||
    session?.user?.username ||
    session?.user?.name ||
    "MyAccount";
  const displayName = userProfile
    ? `${userProfile.first_name} ${userProfile.last_name}`.trim() ||
    userProfile.username
    : session?.user?.name || username || "MyAccount";
  const joinDate = userProfile?.created_at
    ? new Date(userProfile.created_at)
    : new Date();

  const documentsResult = userId
    ? await getUserDocumentsAction(userId)
    : { success: true, documents: [] };

  return (
    <main className="min-h-screen bg-background">
      <NavBar />

      {/* Back link */}
      <div className="md:ml-64 md:pl-4 pt-6">
        <BackHeader href="/app" title="My account" className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pb-4 hidden md:flex gap-4" />
      </div>

      {/* Cover */}
      <div className="md:ml-64 md:pl-4">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
          <div
            className="h-40 md:h-52 w-full relative rounded-2xl overflow-hidden bg-primary"
            style={{
              backgroundImage: userProfile?.banner_image
                ? `url(${userProfile.banner_image})`
                : undefined,
              backgroundColor: userProfile?.banner_image
                ? "transparent"
                : undefined,
              background: userProfile?.banner_image 
                ? `url(${userProfile.banner_image}) cover center`
                : undefined,
            }}
          />
        </div>
      </div>

      <div className="md:ml-64 md:pl-4">
        <section className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 -mt-12 md:-mt-16 pb-10">
          {/* Header */}
          <div className="flex flex-col items-center md:flex-row md:items-end gap-4 relative z-10">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background overflow-hidden bg-muted ring-2 ring-border/30 shadow-lg">
              {userProfile?.profile_image ? (
                <Image
                  src={userProfile.profile_image}
                  alt="Profile photo"
                  width={128}
                  height={128}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                  {getInitials(displayName || null)}
                </div>
              )}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3 justify-center md:justify-start w-full md:w-auto">
              <ProfileEditButton />
            </div>
          </div>

          {/* Identity */}
          <section className="mt-4 text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {displayName}
            </h1>
            <p className="text-muted-foreground">
              @{username || "username"}
            </p>
            <div className="flex items-center justify-center md:justify-start gap-2 mt-2 text-sm text-muted-foreground">
              <Icon name="calendar" className="w-4 h-4" />
              <span>
                Joined in {joinDate.toLocaleString("en-US", { month: "long" })}{" "}
                {joinDate.getFullYear()}
              </span>
            </div>
          </section>

          {/* Notes section */}
          <section className="mt-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              My notes
            </h2>

            {documentsResult.success &&
              documentsResult.documents.length === 0 && (
                <Card className="p-6">
                  <Card.Title>No notes</Card.Title>
                  <Card.Description>
                    Create your first note from the home page.
                  </Card.Description>
                </Card>
              )}

            {documentsResult.success && documentsResult.documents.length > 0 && (
              <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
                {documentsResult.documents
                  .sort((a: any, b: any) => {
                    const dateA = new Date(a.updated_at || a.created_at);
                    const dateB = new Date(b.updated_at || b.created_at);
                    return dateB.getTime() - dateA.getTime(); // Sort descending
                  })
                  .map((document: any) => (
                    <div key={document.id} className="w-full">
                      <DocumentCard
                        document={document}
                        currentUserId={session?.user?.id}
                      />
                    </div>
                  ))}
              </div>
            )}
          </section>
          <div className="flex-1" />
        </section>
      </div>
    </main>
  );
}

function CalendarIcon(props: { className?: string }) {
  return <Icon name="calendar" className={props.className} />;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

