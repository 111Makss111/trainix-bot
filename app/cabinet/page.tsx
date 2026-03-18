import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

export default function CabinetPage() {
  return (
    <>
      <CabinetTopbar
        eyebrow="Cabinet Overview"
        title="Огляд простору"
        description="Починаємо збирати приватний кабінет по частинах. Зліва вже є робочий sidebar, а далі будемо поступово наповнювати кожен розділ окремим функціоналом."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <CabinetCard
          eyebrow="Now"
          title="Навігація вже жива"
          description="Кожен пункт у sidebar клікабельний. Активний розділ підсвічується, тому ти одразу бачиш, де саме зараз знаходишся всередині кабінету."
        />

        <CabinetCard
          eyebrow="Next"
          title="Далі наповнимо блоки"
          description="Після навігації підемо в контент: картки, списки, метрики, нотатки й робочі панелі під твої власні сценарії."
        />
      </div>
    </>
  );
}
