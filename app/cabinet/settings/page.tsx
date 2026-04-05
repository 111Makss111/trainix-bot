import { CabinetTopbar } from "@/components/cabinet";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
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

      <SettingsWorkspace twoFactorState={twoFactorState} />
    </>
  );
}
