import { clearTwoFactorVerificationCookie } from "@/lib/security/two-factor";

export async function POST() {
  await clearTwoFactorVerificationCookie();

  return new Response(null, {
    status: 204,
  });
}
