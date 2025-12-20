import NextAuth, { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { UserService } from "../src/lib/services/UserService";
import { prisma } from "@/lib/prisma";

// Étendre les types NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      username: string;
      firstName: string;
      lastName: string;
      isAdmin: boolean;
      isVerified: boolean;
      isBanned: boolean;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    username: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    isVerified: boolean;
    isBanned: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
    isVerified: boolean;
    isBanned: boolean;
  }
}


interface DatabaseUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password_hash: string | null;
  email_verified: boolean;
  is_banned: boolean;
  is_admin: boolean;
}

const userService = new UserService();

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email or username", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        try {
          if (!credentials) return null;

          const identifier = (credentials.email || "").toString().trim();
          const password = (credentials.password || "").toString();

          if (!identifier || !password) return null;

          const result = await userService.authenticateUser(identifier, password);

          if (!result.success || !result.user) return null;

          const user = result.user;

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.username || user.email,
            username: user.username || "",
            firstName: user.first_name || "",
            lastName: user.last_name || "",
            isAdmin: user.is_admin,
            isVerified: user.email_verified,
            isBanned: user.is_banned,
          };
        } catch (e) {
          console.error("Erreur authorize(credentials):", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          // Check if user already exists
          const existingUser = await userService.getUserByEmail(user.email!);

          if (!existingUser.success) {
            // Vérifier si un compte supprimé existe et est restaurable
            const deleted = await prisma.deletedAccount.findFirst({ where: { email: user.email!.toLowerCase() } });
            const now = new Date();
            const expired = !!(deleted?.expires_at && deleted.expires_at.getTime() <= now.getTime());

            if (deleted && !expired) {
              // Restaurer automatiquement pour OAuth (pas de mot de passe à valider)
              await prisma.$transaction(async (tx) => {
                const usernameCandidate = deleted.username || user.email!.split("@")[0];
                const snapshot = (deleted.user_snapshot as any) || {};
                const data: any = {
                  email: deleted.email,
                  username: usernameCandidate,
                  first_name: deleted.first_name || null,
                  last_name: deleted.last_name || null,
                  password_hash: snapshot.password_hash || null,
                  is_admin: !!deleted.is_admin,
                  email_verified: true,
                  provider: "google",
                  provider_id: account?.providerAccountId || deleted.provider_id || null,
                  is_banned: !!deleted.is_banned,
                  profile_image: deleted.profile_image || null,
                  banner_image: deleted.banner_image || null,
                };
                try {
                  await tx.user.create({ data });
                } catch (_) {
                  // Conflit sur le username, utiliser un fallback
                  await tx.user.create({
                    data: { ...data, username: `${user.email!.split("@")[0]}_restored` },
                  });
                }
                await tx.deletedAccount.delete({ where: { id: deleted.id } });
              });
            } else {
              // Create a new OAuth user
              const emailBase = user.email?.split("@")[0] || "user";
              let username = emailBase;
              
              // Vérifier si le username existe déjà et générer un nom unique si nécessaire
              let usernameExists = true;
              let attempts = 0;
              while (usernameExists && attempts < 10) {
                const checkUsername = await prisma.user.findFirst({ where: { username } });
                if (!checkUsername) {
                  usernameExists = false;
                } else {
                  // Générer un nom unique avec timestamp et random
                  username = `${emailBase}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                  attempts++;
                }
              }

              const firstName =
                String((profile as Record<string, unknown>)?.given_name || user.name?.split(" ")[0] || "");
              const lastName =
                String((profile as Record<string, unknown>)?.family_name ||
                user.name?.split(" ").slice(1).join(" ") ||
                "");

              const createResult = await userService.createOAuthUser({
                email: user.email!,
                username,
                firstName: firstName || "User",
                lastName: lastName || "OAuth",
                provider: "google",
                providerId: account?.providerAccountId || "",
              });

              // Si la création échoue à cause d'un username en double, réessayer avec un nouveau nom
              if (!createResult.success && createResult.error?.includes("username")) {
                username = `${emailBase}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
                await userService.createOAuthUser({
                  email: user.email!,
                  username,
                  firstName: firstName || "User",
                  lastName: lastName || "OAuth",
                  provider: "google",
                  providerId: account?.providerAccountId || "",
                });
              }
            }
          }
        } catch (error) {
          console.error(
            "Error during user creation/login:",
            error
          );
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session?.user) {
        try {
          const userResult = await userService.getUserByEmail(session.user.email);

          if (userResult.success && userResult.user) {
            const user = userResult.user;
            session.user.id = user.id.toString();
            session.user.username = user.username || "";
            session.user.firstName = user.first_name || "";
            session.user.lastName = user.last_name || "";
            session.user.isAdmin = user.is_admin;
            session.user.isVerified = user.email_verified;
            session.user.isBanned = user.is_banned;
          }
        } catch (error) {
          console.error(
            "Error during user data retrieval:",
            error
          );
        }
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.isAdmin = user.isAdmin;
        token.isVerified = user.isVerified;
        token.isBanned = user.isBanned;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
};

export default NextAuth(authOptions);