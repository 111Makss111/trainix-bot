import { CabinetCard, CabinetTopbar } from "@/components/cabinet";
import { TwoFactorSettingsCard } from "@/components/settings/TwoFactorSettingsCard";
import { requireOwnerEmail } from "@/lib/auth-guards";
import { getTwoFactorSettingsState } from "@/lib/security/two-factor";

export default async function SettingsPage() {
  const ownerEmail = await requireOwnerEmail();
  const twoFactorState = await getTwoFactorSettingsState(ownerEmail);

  return (
    <>
      <CabinetTopbar
        eyebrow="Settings"
        title="Налаштування кабінету"
        description="Тут живе весь контроль над приватним простором: безпека входу, доступ до інтеграцій і ті налаштування, які реально впливають на твій робочий контур."
      />

      <TwoFactorSettingsCard initialState={twoFactorState} />

      <CabinetCard
        eyebrow="Security Note"
        title="Google login залишається першим бар'єром"
        description="2FA у кабінеті не замінює захист твого Google-акаунта. Найкраща схема тут подвійна: Google owner-only login + код із authenticator app уже всередині самого кабінету."
      />
    </>
  );
}
