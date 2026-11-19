import { Link } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="container-page max-w-2xl pt-16 sm:pt-24">
      <p className="font-display text-lg font-semibold text-green">{t("Page not found")}</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{t("There is nothing at this address")}</h1>
      <p className="mt-3 text-lg text-muted">{t("The link may be old or typed wrong.")}</p>
      <Link to="/" className="btn-primary mt-8">
        {t("Go to the home page")}
      </Link>
    </div>
  );
}
