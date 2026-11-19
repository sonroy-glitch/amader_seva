import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import AccountMenu from "./AccountMenu.jsx";
import { useLang } from "../lib/i18n.jsx";

function navClass({ isActive }) {
  return `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
    isActive ? "text-green" : "text-ink/80 hover:text-ink"
  }`;
}

// English / বাংলা switch
function LanguageSwitch() {
  const { lang, setLang } = useLang();
  // Short labels on phones so the header fits
  const options = [
    ["en", "English", "EN", "en"],
    ["bn", "বাংলা", "বাং", "bn"],
  ];
  return (
    <div role="group" aria-label="Language / ভাষা" className="flex rounded-lg border border-line bg-card p-0.5">
      {options.map(([value, label, shortLabel, labelLang]) => (
        <button
          key={value}
          lang={labelLang}
          onClick={() => setLang(value)}
          aria-pressed={lang === value}
          aria-label={label}
          className={`rounded-md px-2.5 py-1 text-sm font-semibold transition-colors ${
            lang === value ? "bg-green text-paper" : "text-ink/70 hover:text-ink"
          }`}
        >
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    setOpen(false);
    navigate("/");
  }

  const links = (
    <>
      {user?.role !== "PROVIDER" && (
        <NavLink to="/" end className={navClass} onClick={() => setOpen(false)}>
          {t("Find help")}
        </NavLink>
      )}
      {user?.role === "PROVIDER" && (
        <NavLink to="/provider" className={navClass} onClick={() => setOpen(false)}>
          {t("My profile")}
        </NavLink>
      )}
      {user?.role === "ADMIN" && (
        <NavLink to="/admin" className={navClass} onClick={() => setOpen(false)}>
          {t("Admin")}
        </NavLink>
      )}
      {user && user.role !== "ADMIN" && (
        <NavLink to="/bookings" className={navClass} onClick={() => setOpen(false)}>
          {user.role === "PROVIDER" ? t("Jobs") : t("Bookings")}
        </NavLink>
      )}
    </>
  );

  // Only in the phone menu; on bigger screens it is in the name menu
  const phoneOnlyLinks = user && (
    <>
      {user.role === "CUSTOMER" && (
        <NavLink to="/addresses" className={navClass} onClick={() => setOpen(false)}>
          {t("Saved addresses")}
        </NavLink>
      )}
      <NavLink to="/account" className={navClass} onClick={() => setOpen(false)}>
        {t("Account settings")}
      </NavLink>
    </>
  );

  return (
    <header className="border-b border-line/70 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/80 sticky top-0 z-30">
      <div className="container-page flex h-16 items-center justify-between gap-2 min-[360px]:gap-3">
        <Link to="/" className="flex shrink-0 items-baseline gap-2" onClick={() => setOpen(false)}>
          {lang === "bn" ? (
            <span className="whitespace-nowrap font-display text-[19px] font-semibold text-green [font-stretch:88%] min-[360px]:text-[22px]">আমাদের সেবা</span>
          ) : (
            <>
              <span className="whitespace-nowrap font-display text-[19px] font-semibold tracking-tight min-[360px]:text-[22px] text-green [font-stretch:88%]">
                Amader Seva
              </span>
              <span lang="bn" className="hidden font-display text-sm text-muted lg:inline">
                আমাদের সেবা
              </span>
            </>
          )}
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {links}
            <span className="mx-2 h-5 w-px bg-line" />
            {user ? (
              <AccountMenu onLogout={handleLogout} />
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  {t("Log in")}
                </NavLink>
                <Link to="/register" className="btn-primary ml-1 py-2">
                  {t("Sign up")}
                </Link>
              </>
            )}
            <span className="mx-2 h-5 w-px bg-line" />
          </nav>

          <LanguageSwitch />

          <button
            className="btn-outline shrink-0 whitespace-nowrap px-3 py-1.5 md:hidden"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            {open ? t("Close") : t("Menu")}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" className="border-t border-line bg-paper md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links}
            {phoneOnlyLinks}
            <div className="mt-2 border-t border-line pt-3">
              {user ? (
                <div className="flex items-center justify-between">
                  <span className="px-3 text-muted">{t("Logged in as {name}", { name: user.name })}</span>
                  <button onClick={handleLogout} className="btn-quiet py-2">
                    {t("Log out")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/login" className="btn-outline" onClick={() => setOpen(false)}>
                    {t("Log in")}
                  </Link>
                  <Link to="/register" className="btn-primary" onClick={() => setOpen(false)}>
                    {t("Sign up")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
