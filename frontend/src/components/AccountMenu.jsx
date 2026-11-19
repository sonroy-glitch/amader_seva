import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";
import { StatusBadge } from "./ui.jsx";

// The name button in the header. Opens a small menu with the latest bookings and account links.
export default function AccountMenu({ onLogout }) {
  const { user } = useAuth();
  const { t, formatDate, slotLabel } = useLang();
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState(null);
  const box = useRef(null);
  const isCustomer = user.role === "CUSTOMER";

  // Fresh bookings each time the menu opens
  useEffect(() => {
    if (!open || !isCustomer) return;
    api("/bookings/my")
      .then((data) => setBookings(data.bookings.slice(0, 3)))
      .catch(() => setBookings([]));
  }, [open, isCustomer]);

  // Close on a click outside or on Escape
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (!box.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass = "block rounded-lg px-3 py-2 text-[15px] font-medium hover:bg-sand";

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[15px] font-semibold text-ink hover:bg-sand"
      >
        {user.name.split(" ")[0]}
        <svg viewBox="0 0 20 20" aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-2xl border border-line bg-paper p-2 shadow-[0_12px_32px_-12px_rgba(29,43,37,0.25)]">
          <div className="px-3 pb-2 pt-1.5">
            <p className="font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>

          {isCustomer && (
            <div className="border-t border-line px-1 pt-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Latest bookings")}</p>
              {!bookings && <p className="px-2 py-3 text-sm text-muted">{t("Loading")}</p>}
              {bookings && bookings.length === 0 && <p className="px-2 py-3 text-sm text-muted">{t("No bookings yet.")}</p>}
              {bookings && bookings.length > 0 && (
                <ul className="mt-1.5">
                  {bookings.map((b) => (
                    <li key={b.id}>
                      <Link to="/bookings" onClick={close} className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 hover:bg-sand">
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold">{t(b.service)}</span>
                          <span className="block text-xs text-muted">
                            {formatDate(b.date)}, {slotLabel(b.slot).toLowerCase()}
                          </span>
                        </span>
                        <StatusBadge status={b.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-2 border-t border-line pt-2">
            {user.role !== "ADMIN" && (
              <Link to="/bookings" onClick={close} className={itemClass}>
                {isCustomer ? t("All bookings") : t("Bookings")}
              </Link>
            )}
            {isCustomer && (
              <Link to="/addresses" onClick={close} className={itemClass}>
                {t("Saved addresses")}
              </Link>
            )}
            <Link to="/account" onClick={close} className={itemClass}>
              {t("Account settings")}
            </Link>
            <button
              onClick={() => {
                close();
                onLogout();
              }}
              className={`${itemClass} w-full text-left text-danger`}
            >
              {t("Log out")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
