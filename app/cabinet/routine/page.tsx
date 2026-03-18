import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

export default function RoutinePage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Routine"
        title="Ритм і рутина"
        description="Тут зберемо твій щоденний робочий пульс: повторювані дії, фокус-блоки, звички та контроль виконання."
      />

      <CabinetCard
        eyebrow="Draft"
        title="Сторінка готова для наповнення"
        description="Зараз це базовий розділ-заглушка, але він уже бере участь у живій навігації. Наступним кроком можемо розкласти тут структуру під твою реальну рутину."
      />
    </>
  );
}
