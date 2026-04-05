import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  hasVerifiedTwoFactorForOwner,
  isTwoFactorEnabledForOwner,
} from "@/lib/security/two-factor";

type OwnerAccessState =
  | {
      isOwner: false;
      email: null;
      twoFactorEnabled: false;
      twoFactorVerified: false;
    }
  | {
      isOwner: true;
      email: string;
      twoFactorEnabled: boolean;
      twoFactorVerified: boolean;
    };

export async function getOwnerAccessState(): Promise<OwnerAccessState> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    return {
      isOwner: false,
      email: null,
      twoFactorEnabled: false,
      twoFactorVerified: false,
    };
  }

  const email = session.user.email.trim().toLowerCase();
  const twoFactorEnabled = await isTwoFactorEnabledForOwner(email);
  const twoFactorVerified = twoFactorEnabled
    ? await hasVerifiedTwoFactorForOwner(email)
    : true;

  return {
    isOwner: true,
    email,
    twoFactorEnabled,
    twoFactorVerified,
  };
}

export async function requireOwnerEmail(options?: {
  requireTwoFactor?: boolean;
}) {
  const access = await getOwnerAccessState();

  if (!access.isOwner || !access.email) {
    throw new Error("Unauthorized");
  }

  if ((options?.requireTwoFactor ?? true) && !access.twoFactorVerified) {
    throw new Error("Two-factor verification required");
  }

  return access.email;
}
