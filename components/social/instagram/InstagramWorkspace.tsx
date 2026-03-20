import { SocialPlatformShell } from "@/components/social/shared/SocialPlatformShell";

const instagramSections = [
  {
    eyebrow: "Structure",
    title: "Account Binding",
    description:
      "Тут буде жити окреме підключення Instagram Professional account і всі налаштування, які не повинні змішуватись із Facebook.",
  },
  {
    eyebrow: "Structure",
    title: "Post Identity",
    description:
      "Окрема зона під стиль Instagram-постів: captions, hooks, hashtags, image style і контентні правила тільки для цього каналу.",
  },
  {
    eyebrow: "Structure",
    title: "Reel / Post Queue",
    description:
      "Майбутня Instagram-черга для feed posts, visuals, reels-ідей і ручного контролю публікації.",
  },
  {
    eyebrow: "Structure",
    title: "History & Logs",
    description:
      "Окремий Instagram-лог, де пізніше буде видно публікації, помилки і всю платформену історію без домішок інших мереж.",
  },
] as const;

export function InstagramWorkspace() {
  return (
    <SocialPlatformShell
      eyebrow="Social / Instagram"
      title="Instagram Ecosystem"
      description="Instagram навмисно живе окремо. Тут буде своя екосистема під візуал, captions, reels і власні правила контенту, незалежно від Facebook-модуля."
      sections={[...instagramSections]}
    />
  );
}
