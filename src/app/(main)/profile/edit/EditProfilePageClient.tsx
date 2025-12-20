"use client";

import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { Button, Card, Input, ImageUpload } from "@/components/ui";
import Icon from "@/components/Icon";
import { updateUserProfileAction } from "@/actions/userActions";
import { useGuardedNavigate } from "@/hooks/useGuardedNavigate";
import { useSession } from "next-auth/react";
import { saveUserSession } from "@/lib/session-utils";
import { useImageValidation } from "@/hooks/useImageValidation";
import Link from "next/link";
import Image from "next/image"; // Added import

interface User {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  name?: string;
  profileImage?: string | null;
  bannerImage?: string | null;
}

interface EditProfilePageClientProps {
  user: User;
}

export default function EditProfilePageClient({ user }: Readonly<EditProfilePageClientProps>) {
  const { checkConnectivity, guardedNavigate } = useGuardedNavigate();
  const { update } = useSession();
  const [message, formAction, isPending] = useActionState(
    updateUserProfileAction,
    undefined
  );

  const initial = useMemo(
    () => ({
      username: user?.username || "",
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      name: user?.name || "",
      profileImage: user?.profileImage || null,
      bannerImage: user?.bannerImage || null,
    }),
    [user]
  );

  const displayName =
    `${initial.firstName} ${initial.lastName}`.trim() ||
    initial.username ||
    initial.name ||
    "MyAccount";

  const [username, setUsername] = useState(initial.username);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email] = useState(initial.email);
  const [profileImage, setProfileImage] = useState<string | null>(initial.profileImage);
  const [bannerImage, setBannerImage] = useState<string | null>(initial.bannerImage);
  const hasSyncedRef = useRef(false);

  const { errors, validateImage, validateProfileImages, clearError } =
    useImageValidation();

  useEffect(() => {
    if (!message || !message.toLowerCase().includes("success")) return;
    if (hasSyncedRef.current) return;
    hasSyncedRef.current = true;

    const doUpdate = async () => {
      const computedName = `${firstName} ${lastName}`.trim() || username || "";
      try {
        await update({
          name: computedName,
          firstName,
          lastName,
          username,
          email,
          profileImage,
          bannerImage,
        });
      } catch (e) {
        console.error("Error updating session:", e);
      }

      try {
        saveUserSession({
          id: user?.id || "unknown",
          email,
          name: computedName,
          firstName,
          lastName,
          username,
          profileImage: profileImage || undefined,
          bannerImage: bannerImage || undefined,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error(
          "Error saving local session:",
          e
        );
      }

      guardedNavigate("/profile");
    };

    const t = setTimeout(() => {
      doUpdate();
    }, 200);
    return () => clearTimeout(t);
  }, [
    message,
    firstName,
    lastName,
    username,
    email,
    user?.id,
    update,
    profileImage,
    bannerImage,
    guardedNavigate
  ]);

  const handleImageChange = (imageType: "profile" | "banner", value: string | null) => {
    if (imageType === "profile") {
      setProfileImage(value);
      if (value) {
        validateImage(value, "profileImage");
      } else {
        clearError("profileImage");
      }
    } else if (imageType === "banner") {
      setBannerImage(value);
      if (value) {
        validateImage(value, "bannerImage");
      } else {
        clearError("bannerImage");
      }
    }
  };

  const handleSubmit = async (formData: FormData) => {
    // Connection check
    const online = await checkConnectivity();
    if (!online) {
      console.log(`[EditProfile] Submission blocked (offline)`);
      return;
    }
    // Validate images before submission
    const profileData = {
      profileImage: profileImage || undefined,
      bannerImage: bannerImage || undefined,
    };

    const validation = validateProfileImages(profileData);
    if (!validation.isValid) {
      return; // Do not submit if validation fails
    }

    formData.set("username", username);
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("email", email);
    if (profileImage) formData.set("profileImage", profileImage);
    if (bannerImage) formData.set("bannerImage", bannerImage);
    startTransition(() => {
      formAction(formData);
    });
  };

  return (
    <div>
      {/* Header with avatar and edit badges like screenshot */}
      <div className="flex flex-col items-center md:flex-row md:items-end gap-4 relative z-10">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-background overflow-hidden bg-muted ring-2 ring-border/30 shadow-lg">
          {profileImage ? (
            <Image
              src={profileImage}
              alt="Profile"
              width={128}
              height={128}
              unoptimized
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
              {getInitials(displayName)}
            </div>
          )}
        </div>
        <div className="flex-1" />
      </div>

      <div className="mt-6">
        <h2 className="font-title text-3xl md:text-4xl text-foreground mb-4">
          Personal Information
        </h2>

        <Card className="px-3 py-6">
          <form action={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              labelClassName="!text-foreground text-xl font-title font-bold"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="bg-card !text-foreground border-0 border-b border-border rounded-none pl-0 pt-0"
              noFocusRing
              endAdornment={<Icon name="pencil" className="w-4 h-4" />}
            />
            <Input
              label="Last Name"
              labelClassName="!text-foreground text-xl font-title font-bold"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className="bg-card !text-foreground border-0 border-b border-border rounded-none pl-0 pt-0"
              noFocusRing
              endAdornment={<Icon name="pencil" className="w-4 h-4" />}
            />
            <Input
              label="First Name"
              labelClassName="!text-foreground text-xl font-title font-bold"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              className="bg-card !text-foreground border-0 border-b border-border rounded-none pl-0 pt-0"
              noFocusRing
              endAdornment={<Icon name="pencil" className="w-4 h-4" />}
            />

            {/* Image fields */}
            <div className="space-y-6">
              <ImageUpload
                label="Profile Picture"
                value={profileImage}
                onChange={(value) => handleImageChange("profile", value)}
                error={errors.profileImage || undefined}
                className="mt-6"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                maxSize={10 * 1024 * 1024} // 10MB
                variant="input"
              />

              <ImageUpload
                label="Banner Image"
                value={bannerImage}
                onChange={(value) => handleImageChange("banner", value)}
                error={errors.bannerImage || undefined}
                className="mt-6"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                maxSize={10 * 1024 * 1024} // 10MB
                recommendedSize="1200x480 pixels"
                variant="input"
              />
            </div>

            {message && (
              <p
                className={`text-sm ${message.toLowerCase().includes("success")
                  ? "text-primary"
                  : "text-destructive"
                  }`}
              >
                {message}
              </p>
            )}

            <div className="flex justify-center pt-2 gap-4">
              <Button
                type="submit"
                loading={isPending}
                variant="primary"
                className="px-6 py-2"
              >
                Update
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="px-6 py-2"
                onClick={() => guardedNavigate("/profile")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
        <div className="flex justify-center pt-10 gap-4">
        <Button variant="danger" className="px-6 py-2" asChild>
            <Link href="/profile/delete">
              Delete Account
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}
