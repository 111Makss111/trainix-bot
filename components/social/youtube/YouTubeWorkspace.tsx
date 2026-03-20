import { SocialPlatformShell } from "@/components/social/shared/SocialPlatformShell";

const youtubeSections = [
  {
    eyebrow: "Structure",
    title: "Channel Connection",
    description:
      "Місце під окреме підключення YouTube-каналу, доступи і майбутні статуси завантаження відео.",
  },
  {
    eyebrow: "Structure",
    title: "Video Pipeline",
    description:
      "Тут житиме окремий конвеєр під Shorts і довші відео: script, scene list, subtitles, render і preview.",
  },
  {
    eyebrow: "Structure",
    title: "Upload Queue",
    description:
      "Окрема черга драфтів тільки для YouTube, щоб не змішувати video-flow із текстовими постами інших платформ.",
  },
  {
    eyebrow: "Structure",
    title: "History & Metrics",
    description:
      "Сюди пізніше підуть upload history, помилки, статуси і первинна аналітика по самому YouTube-модулю.",
  },
] as const;

export function YouTubeWorkspace() {
  return (
    <SocialPlatformShell
      eyebrow="Social / YouTube"
      title="YouTube Ecosystem"
      description="YouTube ми відразу відділяємо як окремий відеомодуль. Тут буде своя логіка, своя черга і свій pipeline під Shorts та інші формати."
      sections={[...youtubeSections]}
    />
  );
}
