import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

const foundationItems = [
  {
    eyebrow: "Portfolio",
    title: "Портфель з нуля",
    description:
      "Тут зберемо активи, середню ціну, частку портфеля, ризик і реальну картину по позиціях.",
  },
  {
    eyebrow: "Research",
    title: "Інвестиційні нотатки",
    description:
      "Для кожної ідеї буде місце під тезу, ризики, сценарій входу, сценарій виходу і причину рішення.",
  },
  {
    eyebrow: "Signals",
    title: "Особисті тригери",
    description:
      "Замість шуму зробимо власні списки спостереження, рівні уваги і зрозумілі сигнали для дії.",
  },
];

export function CryptoWorkspace() {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {foundationItems.map((item) => (
        <CabinetCard
          key={item.eyebrow}
          eyebrow={item.eyebrow}
          title={item.title}
          description={item.description}
        />
      ))}
    </div>
  );
}
