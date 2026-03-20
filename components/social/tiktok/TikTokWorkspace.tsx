import { SocialPlatformShell } from "@/components/social/shared/SocialPlatformShell";

const tiktokSections = [
  {
    eyebrow: "Structure",
    title: "Account Connection",
    description:
      "Окрема зона під TikTok-акаунт, токени доступу і майбутні перевірки з боку цієї конкретної платформи.",
  },
  {
    eyebrow: "Structure",
    title: "Short Video Engine",
    description:
      "Саме тут пізніше буде збиратись short-form pipeline: hooks, scenes, subtitles, cover, audio і вертикальний render.",
  },
  {
    eyebrow: "Structure",
    title: "Draft Queue",
    description:
      "Черга TikTok-драфтів житиме окремо, бо тут інший формат контенту, інший темп і свої правила preview/publish.",
  },
  {
    eyebrow: "Structure",
    title: "History & Control",
    description:
      "Окремий контроль для TikTok-публікацій, логів і майбутніх метрик без змішування з іншими соцмережами.",
  },
] as const;

export function TikTokWorkspace() {
  return (
    <SocialPlatformShell
      eyebrow="Social / TikTok"
      title="TikTok Ecosystem"
      description="TikTok теж живе як окремий модуль. Ми відразу закладаємо під нього свій каркас, бо short video pipeline тут принципово інший, ніж у Facebook чи Instagram."
      sections={[...tiktokSections]}
    />
  );
}
