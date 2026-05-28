import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

export default function SettingsPage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Settings"
        title="Налаштування кабінету"
        description="Цю вкладку залишаємо під майбутній захист фінансового кабінету. Стару 2FA-реалізацію прибрано, щоб не залежати від старої бази і зробити безпеку заново чисто."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <CabinetCard
          eyebrow="Security"
          title="Новий захист буде окремим етапом"
          description="Для фінансів потрібна сильна охорона: повернемо 2FA або кращу схему після того, як спроєктуємо нову базу та правила доступу без старих залежностей."
        />

        <CabinetCard
          eyebrow="Access"
          title="Google owner-only лишається"
          description="Зараз вхід тримається на одному дозволеному Google-акаунті через OWNER_EMAIL. Це простий стабільний контур для періоду перезбірки."
        />
      </div>
    </>
  );
}
