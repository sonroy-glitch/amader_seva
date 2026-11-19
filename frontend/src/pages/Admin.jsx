import { useEffect, useState } from "react";
import { Alert, Loading, StatusBadge } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { formatPhone } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";

export default function Admin() {
  const { t, num } = useLang();
  const [tab, setTab] = useState("providers"); // providers | customers | bookings
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  function loadSummary() {
    api("/admin/summary")
      .then(setSummary)
      .catch((e) => setError(e.message));
  }

  useEffect(loadSummary, []);

  if (error) {
    return (
      <div className="container-page py-16">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!summary) return <div className="container-page"><Loading /></div>;

  const stats = [
    ["Waiting for approval", summary.waiting],
    ["Providers", summary.providers],
    ["Customers", summary.customers],
    ["New requests", summary.bookings.PENDING ?? 0],
    ["Confirmed", summary.bookings.CONFIRMED ?? 0],
    ["Completed", summary.bookings.COMPLETED ?? 0],
  ];

  return (
    <div className="container-page max-w-4xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("Admin")}</h1>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([label, value]) => (
          <div key={label} className="card p-4">
            <dt className="text-sm text-muted">{t(label)}</dt>
            <dd className="mt-1 font-display text-3xl font-semibold">{num(value)}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" className="mt-10 flex gap-1 border-b border-line">
        {[
          ["providers", "Providers"],
          ["customers", "Customers"],
          ["bookings", "Bookings"],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px flex-1 border-b-2 px-2 py-2.5 font-semibold sm:flex-none sm:px-4 transition-colors ${
              tab === value ? "border-green text-green" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {tab === "providers" && <ProviderList onChange={loadSummary} />}
      {tab === "customers" && <CustomerList />}
      {tab === "bookings" && <BookingList onChange={loadSummary} />}
    </div>
  );
}

function ProviderList({ onChange }) {
  const { t } = useLang();
  const [providers, setProviders] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api("/admin/providers")
      .then((data) => setProviders(data.providers))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <div className="mt-6"><Alert>{error}</Alert></div>;
  if (!providers) return <Loading />;
  if (providers.length === 0) return <p className="mt-6 text-muted">{t("No providers yet.")}</p>;

  return (
    <ul className="mt-6 grid gap-4">
      {providers.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          onChange={() => {
            load();
            onChange();
          }}
        />
      ))}
    </ul>
  );
}

function ProviderCard({ provider, onChange }) {
  const { t, num, formatDate, formatPrice, yearsLabel } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function setVerified(isVerified) {
    if (!isVerified && reason.trim().length < 3) return setError("Write why the profile is not approved");
    setError("");
    setSaving(true);
    try {
      await api(`/admin/providers/${provider.id}`, { method: "PATCH", body: { isVerified, rejectReason: reason } });
      setRejecting(false);
      setReason("");
      onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-semibold leading-tight [font-stretch:88%]">{provider.name}</p>
          <p className="mt-1 text-[15px] text-muted">
            {provider.area}, {provider.pincode} · {yearsLabel(provider.experience)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {provider.isBlocked && (
            <span className="rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-paper">{t("Blocked")}</span>
          )}
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              provider.isVerified
                ? "bg-green-soft text-green-dark"
                : provider.rejectReason
                  ? "bg-danger-soft text-danger"
                  : "bg-marigold-soft text-ink"
            }`}
          >
            {provider.isVerified ? t("Approved") : provider.rejectReason ? t("Not approved") : t("Waiting for approval")}
          </span>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-[15px] sm:grid-cols-2">
        <div>
          <dt className="text-muted">{t("Phone")}</dt>
          <dd>
            <a href={`tel:+91${provider.phone}`} className="font-semibold text-green hover:underline">
              {formatPhone(provider.phone)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-muted">{t("Email")}</dt>
          <dd className="break-all">{provider.email}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">{t("Services")}</dt>
          <dd>
            {provider.services.length === 0
              ? t("No services added yet")
              : provider.services
                  .map((s) => (s.fromPrice ? `${t(s.name)} ${t("from {price}", { price: formatPrice(s.fromPrice) })}` : t(s.name)))
                  .join(", ")}
          </dd>
        </div>
        {provider.bio && (
          <div className="sm:col-span-2">
            <dt className="text-muted">{t("About")}</dt>
            <dd className="whitespace-pre-line">{provider.bio}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">{t("Joined")}</dt>
          <dd>{formatDate(provider.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t("Dropped jobs")}</dt>
          <dd className={provider.cancelledAfterAccepting + provider.noShows > 0 ? "font-semibold text-danger" : ""}>
            {t("{cancelled} cancelled after accepting, {missed} did not come", {
              cancelled: num(provider.cancelledAfterAccepting),
              missed: num(provider.noShows),
            })}
          </dd>
        </div>
        {!provider.isVerified && provider.rejectReason && (
          <div className="sm:col-span-2">
            <dt className="text-muted">{t("Reason")}</dt>
            <dd>{provider.rejectReason}</dd>
          </div>
        )}
      </dl>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {rejecting ? (
        <div className="mt-5 rounded-lg bg-danger-soft/60 p-4">
          <label htmlFor={`reason-${provider.id}`} className="label">
            {t("Why is it not approved? The provider will see this.")}
          </label>
          <textarea
            id={`reason-${provider.id}`}
            rows={2}
            maxLength={300}
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => setVerified(false)} disabled={saving} className="btn-danger">
              {saving ? t("Saving") : t("Send and do not approve")}
            </button>
            <button onClick={() => setRejecting(false)} disabled={saving} className="btn-quiet">
              {t("Back")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {!provider.isVerified && (
            <button onClick={() => setVerified(true)} disabled={saving} className="btn-primary">
              {saving ? t("Saving") : t("Approve")}
            </button>
          )}
          {(provider.isVerified || !provider.rejectReason) && (
            <button onClick={() => setRejecting(true)} className="btn-outline">
              {provider.isVerified ? t("Remove approval") : t("Do not approve")}
            </button>
          )}
          <BlockButton userId={provider.userId} isBlocked={provider.isBlocked} onChange={onChange} />
        </div>
      )}
    </li>
  );
}

function BookingList({ onChange }) {
  const { t, formatDate, formatDateTime, formatPriceRange, slotLabel } = useLang();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api("/admin/bookings")
      .then((data) => setBookings(data.bookings))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <div className="mt-6"><Alert>{error}</Alert></div>;
  if (!bookings) return <Loading />;
  if (bookings.length === 0) return <p className="mt-6 text-muted">{t("No bookings yet.")}</p>;

  return (
    <>
      <p className="mt-6 text-sm text-muted">{t("Start code problems first, then the latest 100 bookings.")}</p>
      <ul className="mt-3 grid gap-3">
        {bookings.map((b) => (
          <li key={b.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {t(b.service)}
                  {b.job && ` (${t(b.job)})`} · {formatPriceRange(b.agreedPrice, b.maxPrice)}
                </p>
                <p className="text-sm text-ink/85">
                  {formatDate(b.date)}, {slotLabel(b.slot).toLowerCase()}
                </p>
              </div>
              <StatusBadge status={b.status} />
            </div>
            {b.status === "CONFIRMED" && b.codeProblemAt && !b.startedAt && (
              <StartWork
                id={b.id}
                onChange={() => {
                  load();
                  onChange();
                }}
              />
            )}
            {b.status === "CONFIRMED" && b.startedAt && (
              <CompleteWork
                id={b.id}
                onChange={() => {
                  load();
                  onChange();
                }}
              />
            )}
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">{t("Customer")}</dt>
                <dd>
                  {b.customerName} · {formatPhone(b.customerPhone)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t("Provider")}</dt>
                <dd>
                  {b.providerName} · {formatPhone(b.providerPhone)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">{t("Address")}</dt>
                <dd className="whitespace-pre-line">{b.address}</dd>
              </div>
              {b.startedAt && (
                <div>
                  <dt className="text-muted">{t("Work started")}</dt>
                  <dd>{formatDateTime(b.startedAt)}</dd>
                </div>
              )}
              {b.status === "CANCELLED" && b.cancelledBy && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">{t("Cancelled by")}</dt>
                  <dd>
                    {t(CANCELLED_BY[b.cancelledBy])}
                    {b.cancelReason && ` · ${b.cancelReason}`}
                  </dd>
                </div>
              )}
            </dl>
            {(b.status === "PENDING" || b.status === "CONFIRMED") && !b.startedAt && (
              <CancelBooking
                id={b.id}
                onChange={() => {
                  load();
                  onChange();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const CANCELLED_BY = {
  CUSTOMER: "Customer",
  DECLINED: "Provider declined the request",
  PROVIDER: "Provider, after accepting",
  NO_SHOW: "Provider did not come (customer reported)",
  ADMIN: "Amader Seva",
  NOT_STARTED: "Closed on its own, work never started",
};

// The provider says the customer won't give the start code.
// Call both people first, then let the work start if the provider is there.
function StartWork({ id, onChange }) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    setSaving(true);
    try {
      await api(`/admin/bookings/${id}/start`, { method: "POST" });
      onChange();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-marigold-soft p-3">
      <p className="text-sm font-semibold">{t("Code problem: the provider says the customer did not give the start code.")}</p>
      <p className="mt-1 text-sm">{t("Call both people. If the provider is there, let the work start.")}</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <button onClick={start} disabled={saving} className="btn-primary mt-2">
        {saving ? t("Saving") : t("Let work start")}
      </button>
    </div>
  );
}

// The work started but the provider did not mark it completed
function CompleteWork({ id, onChange }) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function complete() {
    setError("");
    setSaving(true);
    try {
      await api(`/admin/bookings/${id}/complete`, { method: "POST" });
      onChange();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg bg-green-soft p-3">
      <p className="text-sm">{t("Work started. If the provider forgot to mark it completed, check with the customer and do it here.")}</p>
      {error && (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      )}
      <button onClick={complete} disabled={saving} className="btn-outline mt-2">
        {saving ? t("Saving") : t("Mark completed")}
      </button>
    </div>
  );
}

function CancelBooking({ id, onChange }) {
  const { t } = useLang();
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    setError("");
    setSaving(true);
    try {
      await api(`/admin/bookings/${id}/cancel`, { method: "POST" });
      onChange();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {asking ? (
        <div className="rounded-lg bg-danger-soft/60 p-3">
          <p className="text-sm">{t("Cancel this booking? The customer and the provider will get an email.")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={cancel} disabled={saving} className="btn-danger">
              {saving ? t("Cancelling") : t("Yes, cancel booking")}
            </button>
            <button onClick={() => setAsking(false)} disabled={saving} className="btn-quiet">
              {t("Keep booking")}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAsking(true)} className="btn-outline">
          {t("Cancel booking")}
        </button>
      )}
    </div>
  );
}

function CustomerList() {
  const { t, formatDate, num } = useLang();
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState("");

  function load() {
    api("/admin/customers")
      .then((data) => setCustomers(data.customers))
      .catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <div className="mt-6"><Alert>{error}</Alert></div>;
  if (!customers) return <Loading />;
  if (customers.length === 0) return <p className="mt-6 text-muted">{t("No customers yet.")}</p>;

  return (
    <ul className="mt-6 grid gap-3">
      {customers.map((c) => (
        <li key={c.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0 text-[15px]">
            <p className="font-semibold">
              {c.name}
              {c.isBlocked && (
                <span className="ml-2 rounded-full bg-danger px-2 py-0.5 text-xs text-paper">{t("Blocked")}</span>
              )}
            </p>
            <p className="break-all text-sm text-muted">
              {c.email} · {formatPhone(c.phone)}
            </p>
            <p className="text-sm text-muted">
              {t("Joined")} {formatDate(c.createdAt)} · {t("Bookings")}: {num(c.bookings)}
            </p>
          </div>
          <BlockButton userId={c.id} isBlocked={c.isBlocked} onChange={load} />
        </li>
      ))}
    </ul>
  );
}

// Block or unblock a customer or provider
function BlockButton({ userId, isBlocked, onChange }) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (!isBlocked && !window.confirm(t("Block this account? They will be logged out, and their upcoming bookings will be cancelled."))) return;
    setError("");
    setSaving(true);
    try {
      await api(`/admin/users/${userId}`, { method: "PATCH", body: { isBlocked: !isBlocked } });
      onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="shrink-0">
      <button onClick={toggle} disabled={saving} className={isBlocked ? "btn-outline" : "btn-danger"}>
        {saving ? t("Saving") : isBlocked ? t("Unblock") : t("Block")}
      </button>
      {error && <p className="mt-1 text-sm text-danger">{t(error)}</p>}
    </div>
  );
}
