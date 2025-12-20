import NextAuth, { NextAuthOptions, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Extend NextAuth types
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
    id: string; // NextAuth expects string ID
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

          const identifier = (credentials.email || "").toString().trim().toLowerCase();
          const password = (credentials.password || "").toString();

          if (!identifier || !password) return null;

          if (!process.env.DATABASE_URL) {
            // Simulation
            if (identifier === "admin@example.com" && password === "password") {
               return {
                   id: "1",
                   email: "admin@example.com",
                   name: "admin",
                   username: "admin",
                   firstName: "Admin",
                   lastName: "User",
                   isAdmin: true,
                   isVerified: true,
                   isBanned: false
               };
            }
            return null;
          }

          // Find user by email or username
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: identifier },
                { username: identifier } // username comparison might need to be case sensitive depending on collation, typically fine
              ]
            }
          });

          if (!user || !user.password_hash) return null;

          if (user.is_banned) {
              // Optionally throw error or return null. 
              // NextAuth doesn't handle errors gracefully in authorize without throwing
              // But returning null is standard for "invalid credentials"
              // If we want specific error message, we throw. 
              // User Actions previously checked banned status before signIn.
              return null;
          }

          const isValid = await bcrypt.compare(password, user.password_hash);
          if (!isValid) return null;

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
          console.error("Authorize error:", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          if (!process.env.DATABASE_URL) return true;

          const email = user.email!.toLowerCase();
          const existingUser = await prisma.user.findUnique({ where: { email } });

          if (!existingUser) {
            // Check for deleted account
            const deleted = await prisma.deletedAccount.findFirst({ where: { email } });
            const now = new Date();
            const expired = !!(deleted?.expires_at && deleted.expires_at.getTime() <= now.getTime());

            if (deleted && !expired) {
               // Restore deleted account logic
               // Using transaction to delete deleted_accounts entry and recreate user
               await prisma.$transaction(async (tx) => {
                   const snapshot = (deleted.user_snapshot as any) || {};
                   const baseUsername = deleted.username || email.split("@")[0];
                   
                   // Ensure username uniqueness for restored user
                   let username = baseUsername;
                   let attempts = 0;
                   while (attempts < 10) {
                       const exists = await tx.user.findFirst({ where: { username } });
                       if (!exists) break;
                       username = `${baseUsername}_restored_${Date.now()}`;
                       attempts++;
                   }

                   await tx.user.create({
                       data: {
                           email: deleted.email,
                           username: username,
                           first_name: deleted.first_name || null,
                           last_name: deleted.last_name || null,
                           password_hash: snapshot.password_hash || null,
                           is_admin: !!deleted.is_admin,
                           email_verified: true,
                           provider: "google",
                           provider_id: account.providerAccountId || deleted.provider_id || null,
                           is_banned: !!deleted.is_banned,
                           profile_image: deleted.profile_image || null,
                           banner_image: deleted.banner_image || null,
                       }
                   });
                   await tx.deletedAccount.delete({ where: { id: deleted.id } });
               });
            } else {
               // Create new OAuth user
               const emailBase = email.split("@")[0];
               let username = emailBase;
               
               // Uniqueness loop
               let attempts = 0;
               while (attempts < 10) {
                   const check = await prisma.user.findUnique({ where: { username } });
                   if (!check) break;
                   username = `${emailBase}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
                   attempts++;
               }

               const firstName = (profile as any)?.given_name || user.name?.split(" ")[0] || "User";
               const lastName = (profile as any)?.family_name || user.name?.split(" ").slice(1).join(" ") || "OAuth";

               await prisma.user.create({
                   data: {
                       email: email,
                       username: username,
                       first_name: firstName,
                       last_name: lastName,
                       provider: "google",
                       provider_id: account.providerAccountId,
                       email_verified: true,
                   }
               });
            }
          }
        } catch (error) {
          console.error("Error during user creation/login:", error);
          return false;
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session?.user && session.user.email) { // Ensure email is present
        try {
            if (!process.env.DATABASE_URL) {
                // Keep defaults from token if simulation
                return session;
            }

          const user = await prisma.user.findUnique({ where: { email: session.user.email } });

          if (user) {
            session.user.id = user.id.toString();
            session.user.username = user.username || "";
            session.user.firstName = user.first_name || "";
            session.user.lastName = user.last_name || "";
            session.user.isAdmin = user.is_admin;
            session.user.isVerified = user.email_verified;
            session.user.isBanned = user.is_banned;
          }
        } catch (error) {
          console.error("Error during user data retrieval:", error);
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