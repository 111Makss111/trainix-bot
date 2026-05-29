import { StrategyPageLayout } from "@/components/crypto/strategies/shared/StrategyPageLayout";

export function TradePlanReviewerStrategy() {
  return (
    <StrategyPageLayout
      eyebrow="Strategy 03"
      title="Trade Plan Reviewer"
      description="Не сигнал на вхід, а перевірка дисципліни: чи є план, ризик, стоп, цілі, інвалідація і причина, яка не схожа на FOMO."
      status="Підготовка форми"
      focus="Перший MVP може бути найкориснішим саме тут: вводиш ідею угоди, а кабінет показує, що відсутнє, де ризик занадто великий і чи варто ставити статус no-trade."
      metrics={[
        {
          label: "Signal",
          value: "Decision",
          detail: "Оцінюємо якість плану, а не прогнозуємо ринок.",
        },
        {
          label: "Output",
          value: "Grade",
          detail: "Ready, review, weak або no-trade.",
        },
        {
          label: "Risk",
          value: "Strict",
          detail: "Без стопа, цілей і інвалідації план не проходить.",
        },
      ]}
      blocks={[
        {
          eyebrow: "Plan",
          title: "Що вводимо",
          items: [
            "Монета, напрямок, зона входу і причина ідеї.",
            "Стоп або точка, де ідея стає неправильною.",
            "Цілі, розмір позиції і ризик у відсотках.",
          ],
        },
        {
          eyebrow: "Review",
          title: "Що перевіряємо",
          items: [
            "Чи не завеликий ризик для дистанції до стопа.",
            "Чи не вхід посеред діапазону без переваги.",
            "Чи не суперечить план активній стратегії або ринку.",
          ],
        },
        {
          eyebrow: "Screen",
          title: "Що буде на сторінці",
          items: [
            "Конструктор плану угоди.",
            "Risk calculator і checklist дисципліни.",
            "Панель огляду з рішенням: готово, переробити або no-trade.",
          ],
        },
      ]}
    />
  );
}
