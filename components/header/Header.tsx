import { AuthEntry } from "@/components/auth";
import { HeaderLogo } from "./HeaderLogo";

type HeaderProps = {
  authError?: string;
  isAuthenticated: boolean;
};

export function Header({ authError, isAuthenticated }: HeaderProps) {
  return (
    <header className="relative z-20 px-5 py-5 sm:px-7 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <HeaderLogo />
        <AuthEntry authError={authError} isAuthenticated={isAuthenticated} />
      </div>
    </header>
  );
}
