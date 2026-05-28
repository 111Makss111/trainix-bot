import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type OwnerAccessState =
  | {
      isOwner: false;
      email: null;
    }
  | {
      isOwner: true;
      email: string;
    };

export async function getOwnerAccessState(): Promise<OwnerAccessState> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.isOwner || !session.user.email) {
    return {
      isOwner: false,
      email: null,
    };
  }

  const email = session.user.email.trim().toLowerCase();

  return {
    isOwner: true,
    email,
  };
}

export async function requireOwnerEmail() {
  const access = await getOwnerAccessState();

  if (!access.isOwner || !access.email) {
    throw new Error("Unauthorized");
  }

  return access.email;
}
