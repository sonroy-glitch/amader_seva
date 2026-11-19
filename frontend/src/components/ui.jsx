import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useLang } from "../lib/i18n.jsx";

// Messages (ours or from the server) are in English and get translated here
export function Alert({ children, tone = "danger" }) {
  const { t } = useLang();
  if (!children) return null;
  const tones = {
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-green/25 bg-green-soft text-green-dark",
    note: "border-marigold/40 bg-marigold-soft text-ink",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {typeof children === "string" ? t(children) : children}
    </div>
  );
}

// A short red error line under a form
export function FieldError({ children }) {
  const { t } = useLang();
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-danger">
      {t(children)}
    </p>
  );
}

export function Loading({ text = "Loading" }) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-3 py-16 text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-green motion-reduce:animate-none" />
      {t(text)}
    </div>
  );
}

const STATUS_STYLES = {
  PENDING: "bg-marigold-soft text-ink",
  CONFIRMED: "bg-green-soft text-green-dark",
  COMPLETED: "bg-sand text-ink",
  CANCELLED: "bg-danger-soft text-danger",
  EXPIRED: "bg-danger-soft text-danger",
};

const STATUS_LABELS = {
  PENDING: "Waiting for reply",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "No reply",
};

export function StatusBadge({ status }) {
  const { t } = useLang();
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {t(STATUS_LABELS[status])}
    </span>
  );
}

// Sends logged-out people to login, and the wrong role back home
export function RequireAuth({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (role && user.role !== role) {
    return <WrongAccount role={role} />;
  }
  return children;
}

// Shown instead of a page that needs another kind of account,
// for example an admin or provider opening a booking link
function WrongAccount({ role }) {
  const { logout } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const names = { CUSTOMER: "customer", PROVIDER: "provider", ADMIN: "admin" };

  function switchAccount() {
    logout();
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  }

  return (
    <div className="container-page max-w-2xl py-16">
      <div className="card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("This page needs a {role} account", { role: t(names[role]) })}</h1>
        <p className="mt-3 text-muted">
          {role === "CUSTOMER"
            ? t("You are logged in with a provider or admin account, which can't book services. Log in with a customer account to book.")
            : t("Log in with the right account to open this page.")}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button onClick={switchAccount} className="btn-primary">
            {t("Log out and use another account")}
          </button>
          <button onClick={() => navigate(-1)} className="btn-outline">
            {t("Go back")}
          </button>
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Request sent", "Accepted", "Work done"];

// Where a booking is: sent, accepted by the provider, finished
export function BookingSteps({ status }) {
  const { t } = useLang();
  if (status === "CANCELLED" || status === "EXPIRED") return null;
  const done = { PENDING: 1, CONFIRMED: 2, COMPLETED: 3 }[status] || 0;
  return (
    <ol className="grid grid-cols-3 gap-2">
      {STEPS.map((step, i) => (
        <li key={step} aria-current={i === done - 1 ? "step" : undefined}>
          <span className={`block h-1.5 rounded-full ${i < done ? "bg-green" : "bg-line"}`} />
          <span className={`mt-2 block text-xs sm:text-sm ${i < done ? "font-semibold text-ink" : "text-muted"}`}>
            {t(step)}
          </span>
        </li>
      ))}
    </ol>
  );
}
