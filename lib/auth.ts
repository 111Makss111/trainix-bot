import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isOwnerAuthDatabaseFallbackEnabled } from "@/lib/owner-auth-fallback";
import { ensureOwnerProfile } from "@/lib/owner-profile";

function getOwnerEmail() {
  return process.env.OWNER_EMAIL?.trim().toLowerCase() ?? null;
}

function isOwnerEmail(email?: string | null) {
  const ownerEmail = getOwnerEmail();

  if (!ownerEmail || !email) {
    return false;
  }

  return email.trim().toLowerCase() === ownerEmail;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const email = user.email?.trim().toLowerCase();
      const googleSub = typeof profile?.sub === "string" ? profile.sub : null;

      // This app is private: only the configured owner can sign in.
      if (!isOwnerEmail(email)) {
        return false;
      }

      if (email && googleSub) {
        try {
          await ensureOwnerProfile({
            email,
            googleSub,
            name: user.name,
            image: user.image,
          });
        } catch (error) {
          console.error("Failed to sync owner profile during sign-in", error);

          if (!isOwnerAuthDatabaseFallbackEnabled()) {
            return "/?error=DatabaseUnavailable";
          }
        }
      }

      return true;
    },
    async jwt({ token, user, profile }) {
      if (user?.email) {
        token.email = user.email.trim().toLowerCase();
      }

      if (typeof profile?.sub === "string") {
        token.googleSub = profile.sub;
      }

      token.isOwner = isOwnerEmail(token.email);

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = typeof token.email === "string" ? token.email : null;
        session.user.isOwner = Boolean(token.isOwner);
        session.user.googleSub =
          typeof token.googleSub === "string" ? token.googleSub : undefined;
      }

      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }

      try {
        const target = new URL(url);

        if (target.origin === baseUrl) {
          return url;
        }
      } catch {
        return `${baseUrl}/cabinet`;
      }

      return `${baseUrl}/cabinet`;
    },
  },
};
