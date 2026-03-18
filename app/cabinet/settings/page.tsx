import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

export default function SettingsPage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Settings"
        title="Налаштування кабінету"
        description="Тут буде все, що стосується параметрів твого простору: персональні опції, зовнішні інтеграції, тема і службові перемикачі."
      />

      <CabinetCard
        eyebrow="Draft"
        title="Базовий settings-розділ уже на місці"
        description="На цьому етапі головне було зібрати робочий sidebar і перемикання сторінок. Далі тут легко розмістимо реальні налаштування."
      />
    </>
  );
}
