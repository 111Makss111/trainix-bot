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

type CabinetSidebarProps = {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

function BtcRadarIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 17.5 8.5 13l3 3 7-8.5M5 6.5h4.5M5 10h2.5M18.5 15v3.5H15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RangeTouchIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 6.5h14M5 17.5h14M7.5 12h9M9 9.5l-2 2.5 2 2.5M15 9.5l2 2.5-2 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TradePlanIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6.5h10M8 12h10M8 17.5h7M4.8 6.5h.4M4.8 12h.4M4.8 17.5h.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d={collapsed ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={collapsed ? "M5 5v14" : "M19 5v14"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/cabinet/btc-decoupling",
    label: "BTC Radar",
    description: "Відрив монет",
    icon: <BtcRadarIcon />,
  },
  {
    href: "/cabinet/range-touch",
    label: "Range Touch",
    description: "Боковик і зони",
    icon: <RangeTouchIcon />,
  },
  {
    href: "/cabinet/trade-plan-reviewer",
    label: "Plan Reviewer",
    description: "Перевірка угоди",
    icon: <TradePlanIcon />,
  },
  {
    href: "/cabinet/settings",
    label: "Налаштування",
    description: "Майбутній захист",
    icon: <SettingsIcon />,
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/cabinet") {
    return pathname === "/cabinet";
  }

  return pathname.startsWith(href);
}

export function CabinetSidebar({
  collapsed = false,
  onToggleCollapsed,
}: CabinetSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <aside
      className={[
        "flex h-full flex-col rounded-[2rem] border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300",
        collapsed ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div
        className={[
          "rounded-[1.5rem] border border-white/8 bg-white/[0.03] transition-all",
          collapsed ? "px-2 py-3" : "px-4 py-4",
        ].join(" ")}
      >
        {collapsed ? (
          <div className="flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-white/6 shadow-[0_0_24px_rgba(117,143,255,0.12)] backdrop-blur-md">
              <span className="h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.85)]" />
            </span>
          </div>
        ) : (
          <HeaderLogo />
        )}
      </div>

      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Розгорнути sidebar" : "Згорнути sidebar"}
        className={[
          "mt-3 flex items-center rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white/68 transition hover:border-white/16 hover:bg-white/[0.07] hover:text-white",
          collapsed ? "justify-center" : "justify-between gap-3",
        ].join(" ")}
      >
        {collapsed ? null : <span>Згорнути меню</span>}
        <SidebarToggleIcon collapsed={collapsed} />
      </button>

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
              title={collapsed ? `${item.label} - ${item.description}` : undefined}
              className={[
                "group flex items-center rounded-[1.4rem] border transition",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-3",
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

              <span
                className={[
                  "min-w-0 transition-all duration-200",
                  collapsed
                    ? "pointer-events-none hidden opacity-0"
                    : "block opacity-100",
                ].join(" ")}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-1 block text-xs text-white/42">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {collapsed ? (
        <div className="mt-auto flex justify-center">
          <SignOutButton compact />
        </div>
      ) : (
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
      )}
    </aside>
  );
}
