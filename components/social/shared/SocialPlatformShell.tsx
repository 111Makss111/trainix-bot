import { CabinetCard, CabinetTopbar } from "@/components/cabinet";

type SocialPlatformSection = {
  eyebrow: string;
  title: string;
  description: string;
};

type SocialPlatformShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: SocialPlatformSection[];
};

export function SocialPlatformShell({
  eyebrow,
  title,
  description,
  sections,
}: SocialPlatformShellProps) {
  return (
    <>
      <CabinetTopbar
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <CabinetCard
            key={`${section.eyebrow}-${section.title}`}
            eyebrow={section.eyebrow}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    </>
  );
}
