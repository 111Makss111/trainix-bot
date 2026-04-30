"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { HeaderLogo } from "@/components/header/HeaderLogo";
import { SignOutButton } from "@/components/auth";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
};

function OverviewIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5"
        y="3.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="13.5"
        y="3.5"
        width="7"
        height="4.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="13.5"
        y="11"
        width="7"
        height="9.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="3.5"
        y="13.5"
        width="7"
        height="7"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function NotesIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4.5h7.5L18 8v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V6A1.5 1.5 0 0 1 7.5 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 4.5V8H18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12h6M9 15.5h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RoutineIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.8 5.8 4.5 4.5M18.2 5.8l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PracticeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.5 5.5h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-4.25L9.5 21v-2.5h-3a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 10h7M8.5 13.5h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function JobsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8v.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5.5 7.5h13a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3.5 12h17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CryptoIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5v17M8.5 6.5h4.3a2.6 2.6 0 1 1 0 5.2H9.7a2.8 2.8 0 1 0 0 5.6H16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 12h17M12 3.5c2.8 2.5 4.2 5.34 4.2 8.5S14.8 18 12 20.5M12 3.5c-2.8 2.5-4.2 5.34-4.2 8.5S9.2 18 12 20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M13.2 7H15V4.5h-2c-2.4 0-4 1.6-4 4v2H7v2.6h2V19h2.9v-5.9h2.6l.4-2.6h-3V8.9c0-1.1.4-1.9 1.3-1.9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <rect
        x="4.5"
        y="4.5"
        width="15"
        height="15"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="7.2" r="1" fill="currentColor" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 8.5c-.2-1.5-1.3-2.6-2.8-2.8C15.9 5.5 14 5.5 12 5.5s-3.9 0-5.2.2A3.2 3.2 0 0 0 4 8.5c-.2 1.3-.2 2.4-.2 3.5s0 2.2.2 3.5c.2 1.5 1.3 2.6 2.8 2.8 1.3.2 3.2.2 5.2.2s3.9 0 5.2-.2a3.2 3.2 0 0 0 2.8-2.8c.2-1.3.2-2.4.2-3.5s0-2.2-.2-3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="m10 9.5 4.5 2.5L10 14.5v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M14.5 5.5c.4 1.5 1.5 2.7 3 3.3v2.5a6.2 6.2 0 0 1-3-.9v4.9a4.6 4.6 0 1 1-4.6-4.6c.2 0 .4 0 .6.1v2.6a2 2 0 1 0 1.4 1.9V5.5h2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.1 13.5a7.98 7.98 0 0 0 .06-1.5 7.98 7.98 0 0 0-.06-1.5l1.72-1.35a.75.75 0 0 0 .18-.96l-1.63-2.82a.75.75 0 0 0-.9-.33l-2.04.82a7.56 7.56 0 0 0-2.6-1.5l-.31-2.18A.75.75 0 0 0 12.78 2h-3.26a.75.75 0 0 0-.74.63L8.47 4.8a7.56 7.56 0 0 0-2.6 1.5l-2.04-.82a.75.75 0 0 0-.9.33L1.3 8.63a.75.75 0 0 0 .18.96L3.2 10.94a7.98 7.98 0 0 0-.06 1.5c0 .5.02 1 .06 1.5l-1.72 1.35a.75.75 0 0 0-.18.96l1.63 2.82a.75.75 0 0 0 .9.33l2.04-.82a7.56 7.56 0 0 0 2.6 1.5l.31 2.18a.75.75 0 0 0 .74.63h3.26a.75.75 0 0 0 .74-.63l.31-2.18a7.56 7.56 0 0 0 2.6-1.5l2.04.82a.75.75 0 0 0 .9-.33l1.63-2.82a.75.75 0 0 0-.18-.96L19.1 13.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/cabinet",
    label: "Огляд",
    description: "Головна сторінка",
    icon: <OverviewIcon />,
  },

  {
    href: "/cabinet/notes",
    label: "Нотатки",
    description: "Ідеї та чернетки",
    icon: <NotesIcon />,
  },
  {
    href: "/cabinet/routine",
    label: "Routine",
    description: "Графік і ритм",
    icon: <RoutineIcon />,
  },
  {
    href: "/cabinet/practice",
    label: "Practice",
    description: "Dev-задачі й тренажер",
    icon: <PracticeIcon />,
  },
  {
    href: "/cabinet/jobs",
    label: "Jobs",
    description: "Пошук замовлень",
    icon: <JobsIcon />,
  },
  {
    href: "/cabinet/crypto",
    label: "Crypto",
    description: "Графік і ордери",
    icon: <CryptoIcon />,
  },
  {
    href: "/cabinet/web",
    label: "Web",
    description: "Сайти та боти",
    icon: <WebIcon />,
  },
  {
    href: "/cabinet/facebook",
    label: "Facebook",
    description: "Окремий модуль",
    icon: <FacebookIcon />,
  },
  {
    href: "/cabinet/instagram",
    label: "Instagram",
    description: "Окремий модуль",
    icon: <InstagramIcon />,
  },
  {
    href: "/cabinet/youtube",
    label: "YouTube",
    description: "Відеомодуль",
    icon: <YouTubeIcon />,
  },
  {
    href: "/cabinet/tiktok",
    label: "TikTok",
    description: "Short video модуль",
    icon: <TikTokIcon />,
  },
  {
    href: "/cabinet/settings",
    label: "Налаштування",
    description: "Безпека та доступ",
    icon: <SettingsIcon />,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/cabinet") {
    return pathname === "/cabinet";
  }

  return pathname.startsWith(href);
}

export function CabinetSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <aside className="flex h-full flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-4">
        <HeaderLogo />
      </div>

      <nav className="mt-5 flex flex-col gap-2">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              onMouseEnter={() => {
                router.prefetch(item.href);
              }}
              onFocus={() => {
                router.prefetch(item.href);
              }}
              className={[
                "group flex items-center gap-3 rounded-[1.4rem] border px-3 py-3 transition",
                active
                  ? "border-white/16 bg-[linear-gradient(135deg,rgba(124,150,255,0.22),rgba(255,255,255,0.08))] text-white shadow-[0_0_28px_rgba(91,119,230,0.16)]"
                  : "border-transparent bg-transparent text-white/58 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/86",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border transition",
                  active
                    ? "border-white/14 bg-white/10 text-white"
                    : "border-white/8 bg-white/[0.03] text-white/54 group-hover:border-white/12 group-hover:bg-white/[0.06] group-hover:text-white/88",
                ].join(" ")}
              >
                {item.icon}
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-1 block text-xs text-white/42">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-4">
        <p className="text-[0.7rem] uppercase tracking-[0.3em] text-white/38">
          Session
        </p>
        <p className="mt-3 text-sm text-white/64">
          Ти в приватному просторі. Активний розділ завжди підсвічений.
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
