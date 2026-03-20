import { SocialPlatformShell } from "@/components/social/shared/SocialPlatformShell";

const facebookSections = [
  {
    eyebrow: "Structure",
    title: "Connection Zone",
    description:
      "Тут житимуть підключення Facebook-акаунта, page binding і технічний статус доступів саме для Facebook-модуля.",
  },
  {
    eyebrow: "Structure",
    title: "Content Rules",
    description:
      "Окрема зона під tone of voice, формат постів, CTA, шаблони і майбутні AI-правила тільки для Facebook.",
  },
  {
    eyebrow: "Structure",
    title: "Draft Queue",
    description:
      "Саме тут пізніше буде Facebook-черга драфтів: generate, approve, publish, archive без змішування з іншими платформами.",
  },
  {
    eyebrow: "Structure",
    title: "Publish History",
    description:
      "Окремий лог для Facebook: що вийшло, коли вийшло, які були помилки і який контент реально був опублікований.",
  },
] as const;

export function FacebookWorkspace() {
  return (
    <SocialPlatformShell
      eyebrow="Social / Facebook"
      title="Facebook Ecosystem"
      description="Це окремий модуль під Facebook. Зараз ми закладаємо тільки правильний каркас: окрему вкладку, окрему сторінку і окрему зону росту без змішування з Instagram, YouTube чи TikTok."
      sections={[...facebookSections]}
    />
  );
}
