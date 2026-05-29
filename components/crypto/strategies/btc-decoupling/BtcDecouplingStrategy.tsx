import { StrategyPageLayout } from "@/components/crypto/strategies/shared/StrategyPageLayout";

export function BtcDecouplingStrategy() {
  return (
    <StrategyPageLayout
      eyebrow="Strategy 01"
      title="BTC Decoupling Radar"
      description="Ловимо моменти, коли монета перестає йти за біткоїном: сила, слабкість, обʼєм і ранні ознаки окремого руху."
      status="Підготовка логіки"
      focus="Перший корисний екран має показувати watchlist, BTC-рух поруч із рухом монети, відхилення, обʼєм і коротку причину, чому монета виглядає сильнішою або слабшою за ринок."
      metrics={[
        {
          label: "Signal",
          value: "Decoupling",
          detail: "Монета рухається інакше, ніж BTC.",
        },
        {
          label: "Mode",
          value: "Shadow",
          detail: "Спочатку тільки спостереження без торгових рішень.",
        },
        {
          label: "Alert",
          value: "Telegram",
          detail: "Пізніше тільки важливі аномалії з причиною.",
        },
      ]}
      blocks={[
        {
          eyebrow: "Inputs",
          title: "Що треба рахувати",
          items: [
            "Рух BTC і рух монети за однаковий період.",
            "Обʼєм проти середнього обʼєму монети.",
            "Кореляцію монети з BTC і силу пари ALT/BTC.",
          ],
        },
        {
          eyebrow: "Screen",
          title: "Що буде на сторінці",
          items: [
            "Таблиця монет з балом відриву.",
            "Окремий блок BTC-контексту.",
            "Список останніх аномалій з поясненням.",
          ],
        },
        {
          eyebrow: "Tuning",
          title: "Що налаштовується",
          items: [
            "Поріг відхилення для кожної монети.",
            "Таймфрейм: 5m, 15m або 1h.",
            "Cooldown, щоб не ловити шум кожну хвилину.",
          ],
        },
      ]}
    />
  );
}
