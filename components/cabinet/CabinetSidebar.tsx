"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="3.5" width="7" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="11" width="7" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RoutineIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M12 6.5v5.5l3.5 2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
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
      <path d="M14.5 4.5V8H18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12h6M9 15.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M10.2 4.4h3.6l.5 2.2c.4.1.9.3 1.3.5l1.9-1.2 2.5 2.5-1.2 1.9c.2.4.4.9.5 1.3l2.2.5v3.6l-2.2.5c-.1.4-.3.9-.5 1.3l1.2 1.9-2.5 2.5-1.9-1.2c-.4.2-.9.4-1.3.5l-.5 2.2h-3.6l-.5-2.2a6 6 0 0 1-1.3-.5L6.4 20l-2.5-2.5 1.2-1.9a6 6 0 0 1-.5-1.3l-2.2-.5v-3.6l2.2-.5c.1-.4.3-.9.5-1.3L3.9 8.4l2.5-2.5 1.9 1.2c.4-.2.9-.4 1.3-.5l.6-2.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
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
    href: "/cabinet/routine",
    label: "Рутина",
    description: "Ритм і фокус",
    icon: <RoutineIcon />,
  },
  {
    href: "/cabinet/notes",
    label: "Нотатки",
    description: "Ідеї та чернетки",
    icon: <NotesIcon />,
  },
  {
    href: "/cabinet/web",
    label: "Web",
    description: "Сайти та боти",
    icon: <WebIcon />,
  },
  {
    href: "/cabinet/settings",
    label: "Налаштування",
    description: "Параметри простору",
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
