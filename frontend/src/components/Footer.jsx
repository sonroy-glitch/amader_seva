import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";

export default function Footer() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-green [font-stretch:88%]">
            {lang === "bn" ? "আমাদের সেবা" : "Amader Seva"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {t("Verified local workers for homes in your neighbourhood. You pay online on Amader Seva once the work is done.")}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          {user?.role !== "PROVIDER" && (
            <Link to="/" className="hover:text-ink">
              {t("Find help")}
            </Link>
          )}
          {!user && (
            <Link to="/register?role=PROVIDER" className="hover:text-ink">
              {t("Join as a provider")}
            </Link>
          )}
          <Link to="/terms" className="hover:text-ink">
            {t("Terms")}
          </Link>
          <Link to="/privacy" className="hover:text-ink">
            {t("Privacy policy")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
