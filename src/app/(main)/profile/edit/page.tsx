import { auth } from "@/../auth";
import NavBar from "@/components/navigation/NavBar";
import EditProfilePageClient from "./EditProfilePageClient";
import Link from "next/link";
import Icon from "@/components/Icon";
import { getUserProfileAction } from "@/lib/actions";

export default async function EditProfilePage() {
  const session = await auth();
  const userId = session?.user?.id ? Number(session.user.id) : undefined;

  // Load full profile to retrieve images (profile_image, banner_image)
  const profileResult = userId
    ? await getUserProfileAction(userId)
    : { success: true, user: null };
  const userProfile = profileResult.success ? profileResult.user : null;

  // Map to properties expected by the client (camelCase)
  const user = {
    ...session?.user,
    id:
      session?.user?.id ||
      (userProfile?.id !== null && userProfile?.id !== undefined ? String(userProfile.id) : undefined),
    email: userProfile?.email ?? session?.user?.email ?? "",
    username: userProfile?.username ?? session?.user?.username ?? "",
    firstName: userProfile?.first_name ?? session?.user?.firstName ?? "",
    lastName: userProfile?.last_name ?? session?.user?.lastName ?? "",
    name: session?.user?.name ?? "",
    profileImage: userProfile?.profile_image ?? null,
    bannerImage: userProfile?.banner_image ?? null,
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar />

      {/* Back link */}
      <div className="md:ml-64 md:pl-4 pt-6">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 pb-4 hidden md:flex gap-4">
          <Link
            href="/profile"
            className="text-foreground font-semibold flex items-center"
          >
            <Icon name="arrowLeft" className="h-6 w-6 mr-2" />
          </Link>
          <h2 className="font-title text-4xl font-regular">Edit profile</h2>
        </div>
      </div>

      {/* Cover */}
      <div className="md:ml-64 md:pl-4">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
          <div
            className="h-40 md:h-52 w-full relative rounded-2xl overflow-hidden"
            style={{
              backgroundImage: userProfile?.banner_image
                ? `url(${userProfile.banner_image})`
                : "linear-gradient(135deg, var(--primary),var(--primary))",
              backgroundColor: userProfile?.banner_image
                ? "transparent"
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>
      </div>

      <div className="md:ml-64 md:pl-4">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 -mt-12 md:-mt-16 pb-10">
          <EditProfilePageClient user={user} />
        </div>
      </div>
    </div>
  );
}

