import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, FieldError, Loading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { SLOTS } from "../lib/format.js";
import { useServices } from "../lib/useServices.js";
import { useLang } from "../lib/i18n.jsx";

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const [provider, setProvider] = useState(undefined); // undefined = loading, null = no profile yet
  const [error, setError] = useState("");
  const [requests, setRequests] = useState(0);

  function load() {
    return api("/providers/me")
      .then((data) => setProvider(data.provider))
      .catch((e) => (e.status === 404 ? setProvider(null) : setError(e.message)));
  }

  useEffect(() => {
    load();
    // How many booking requests are waiting for an answer
    api("/bookings/my")
      .then((data) => setRequests(data.bookings.filter((b) => b.status === "PENDING").length))
      .catch(() => {});
  }, []);

  if (error) {
    return (
      <div className="container-page py-16">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (provider === undefined) return <div className="container-page"><Loading /></div>;

  return (
    <div className="container-page max-w-3xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {provider ? t("Your profile") : t("Set up your profile")}
      </h1>
      <p className="mt-2 text-lg text-muted">
        {provider
          ? t("This is what customers see when they find you, {name}.", { name: user.name.split(" ")[0] })
          : t("Tell customers where you work and when. Then add the services you offer and your prices.")}
      </p>

      {requests > 0 && (
        <Link
          to="/bookings"
          className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-marigold/40 bg-marigold-soft p-5 font-semibold hover:border-marigold"
        >
          <span>
            {requests === 1
              ? t("You have 1 new job request")
              : t("You have {count} new job requests", { count: requests })}
          </span>
          <span className="text-green">{t("See requests")}</span>
        </Link>
      )}

      {provider && <StatusCard provider={provider} onChange={setProvider} />}

      <ProfileForm provider={provider} onSaved={load} />

      {provider && <ServicesCard provider={provider} onChange={load} />}
    </div>
  );
}

function StatusCard({ provider, onChange }) {
  const { t } = useLang();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setError("");
    setSaving(true);
    try {
      const data = await api("/providers/me/availability", {
        method: "PATCH",
        body: { isAvailable: !provider.isAvailable },
      });
      onChange({ ...provider, isAvailable: data.isAvailable });
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  let title, text, tone;
  if (!provider.isVerified && provider.rejectReason) {
    title = "Not approved";
    text = "Fix what is written below, then save your profile. We will review it again.";
    tone = "bg-danger-soft border-danger/25";
  } else if (!provider.isVerified) {
    title = "Under review";
    text = "We check every new profile before it shows up in search. You can finish your profile and rates meanwhile.";
    tone = "bg-marigold-soft border-marigold/40";
  } else if (provider.isAvailable) {
    title = "You are taking bookings";
    text = "Customers near you can find and book you.";
    tone = "bg-green-soft border-green/25";
  } else {
    title = "Bookings paused";
    text = "You are hidden from search. Bookings you already have stay as they are.";
    tone = "bg-sand border-line";
  }

  return (
    <div className={`mt-8 rounded-2xl border p-5 sm:p-6 ${tone}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl font-semibold">{t(title)}</p>
          <p className="mt-1 text-[15px] text-ink/80">{t(text)}</p>
          {!provider.isVerified && provider.rejectReason && (
            <p className="mt-2 text-[15px]">
              <span className="font-semibold">{t("Reason")}:</span> {provider.rejectReason}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {provider.isVerified && (
            <button onClick={toggle} disabled={saving} className="btn-outline bg-card">
              {provider.isAvailable ? t("Pause bookings") : t("Start taking bookings")}
            </button>
          )}
          <Link to="/bookings" className="btn-primary">
            {t("See my jobs")}
          </Link>
        </div>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
    </div>
  );
}

function ProfileForm({ provider, onSaved }) {
  const { t } = useLang();
  const [form, setForm] = useState({
    area: provider?.area || "",
    pincode: provider?.pincode || "",
    experience: provider ? String(provider.experience) : "",
    bio: provider?.bio || "",
    slots: provider?.slots || [],
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm({ ...form, [field]: value });
    setMessage("");
  }

  function toggleSlot(value) {
    const slots = form.slots.includes(value) ? form.slots.filter((s) => s !== value) : [...form.slots, value];
    update("slots", slots);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.area.trim().length < 2) return setError("Enter the area you work in");
    if (!/^\d{6}$/.test(form.pincode)) return setError("Enter a valid 6 digit pincode");
    if (form.experience === "") return setError("Enter your years of experience");
    if (form.slots.length === 0) return setError("Choose at least one time you can work");
    setError("");
    setSaving(true);
    try {
      const data = await api("/providers/me", {
        method: "PUT",
        body: {
          area: form.area.trim(),
          pincode: form.pincode,
          experience: Number(form.experience),
          bio: form.bio.trim() || undefined,
          slots: SLOTS.map((s) => s.value).filter((v) => form.slots.includes(v)),
        },
      });
      await onSaved();
      if (data.underReview) {
        setMessage("Profile saved. You changed where you work, so we will check your profile again before you show up in search. Bookings you already have stay as they are.");
      } else {
        setMessage(provider ? "Profile saved." : "Profile saved. Now add the services you offer and your prices below.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card mt-8 p-5 sm:p-7">
      <h2 className="text-2xl font-semibold">{t("Where and when you work")}</h2>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="area" className="label">
              {t("Area")}
            </label>
            <input
              id="area"
              className="input"
              placeholder={t("For example: Salt Lake, Sector 1")}
              value={form.area}
              onChange={(e) => update("area", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pincode" className="label">
              {t("Pincode")}
            </label>
            <input
              id="pincode"
              inputMode="numeric"
              maxLength={6}
              className="input"
              value={form.pincode}
              onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))}
            />
            <p className="mt-1.5 text-xs text-muted">{t("Customers searching this pincode will find you.")}</p>
          </div>
        </div>
        <div className="sm:max-w-[calc(50%-0.625rem)]">
          <label htmlFor="experience" className="label">
            {t("Years of experience")}
          </label>
          <input
            id="experience"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            className="input"
            value={form.experience}
            onChange={(e) => update("experience", e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <fieldset>
          <legend className="label">{t("Times you can work, every day")}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {SLOTS.map((s) => {
              const checked = form.slots.includes(s.value);
              return (
                <label
                  key={s.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    checked ? "border-green bg-green-soft" : "border-line bg-card hover:border-ink/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSlot(s.value)}
                    className="mt-1 h-4 w-4 accent-green"
                  />
                  <span>
                    <span className="block text-[15px] font-semibold">{t(s.label)}</span>
                    <span className="block text-xs text-muted">{t(s.time)}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor="bio" className="label">
            {t("About you")} <span className="font-normal text-muted">{t("(optional)")}</span>
          </label>
          <textarea
            id="bio"
            rows={4}
            maxLength={500}
            className="input resize-y"
            placeholder={t("The kind of work you do, tools you bring, languages you speak")}
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
          />
        </div>
        <Alert>{error}</Alert>
        <Alert tone="success">{message}</Alert>
        <div>
          <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto sm:px-8">
            {saving ? t("Saving") : t("Save profile")}
          </button>
        </div>
      </form>
    </section>
  );
}

function ServicesCard({ provider, onChange }) {
  const { services, error: loadError } = useServices();
  const { t } = useLang();

  return (
    <section className="card mt-8 p-5 sm:p-7">
      <h2 className="text-2xl font-semibold">{t("Services and prices")}</h2>
      <p className="mt-1 text-[15px] text-muted">
        {t(
          "Tick the jobs you do and set a fixed price or a short range for each. Customers choose the job when they book and pay online on Amader Seva after the work."
        )}
      </p>
      {loadError && (
        <div className="mt-4">
          <Alert>{loadError}</Alert>
        </div>
      )}
      {services.length === 0 ? (
        !loadError && <Loading />
      ) : (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              offered={provider.services.some((s) => s.serviceId === service.id)}
              myJobs={provider.jobs}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// The top of a range can be at most 3 times the bottom (same rule as the server)
const PRICE_SPREAD = 3;

function ServiceRow({ service, offered, myJobs, onChange }) {
  const { t, formatPrice } = useLang();

  // { jobId: { on, min, max } } from my saved prices
  function savedPrices() {
    const prices = {};
    for (const job of service.jobs) {
      const mine = myJobs.find((j) => j.jobId === job.id);
      prices[job.id] = {
        on: Boolean(mine),
        min: mine ? String(mine.minPrice) : "",
        max: mine && mine.maxPrice > mine.minPrice ? String(mine.maxPrice) : "",
      };
    }
    return prices;
  }

  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState(savedPrices);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function setJob(jobId, change) {
    setPrices({ ...prices, [jobId]: { ...prices[jobId], ...change } });
  }

  async function save(e) {
    e.preventDefault();
    const jobs = [];
    for (const job of service.jobs) {
      const price = prices[job.id];
      if (!price.on) continue;
      const min = Number(price.min);
      const max = job.isCheckup || !price.max ? min : Number(price.max);
      if (!min) return setError(t("Enter a price for {job}", { job: t(job.name) }));
      if (max < min) return setError(t("For {job}, the highest price can't be less than the lowest", { job: t(job.name) }));
      if (max > min * PRICE_SPREAD) {
        return setError(t("For {job}, the highest price can be at most 3 times the lowest", { job: t(job.name) }));
      }
      jobs.push({ jobId: job.id, minPrice: min, maxPrice: max });
    }
    if (jobs.length === 0) return setError(t("Tick at least one job you do"));
    setError("");
    setSaving(true);
    try {
      await api("/providers/me/services", { method: "PUT", body: { serviceId: service.id, jobs } });
      await onChange();
      setOpen(false);
    } catch (e) {
      setError(t(e.message));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    setSaving(true);
    try {
      await api(`/providers/me/services/${service.id}`, { method: "DELETE" });
      await onChange();
      setOpen(false);
    } catch (e) {
      setError(t(e.message));
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    setPrices(savedPrices());
    setError("");
    setOpen(!open);
  }

  const doneJobs = myJobs.filter((j) => service.jobs.some((job) => job.id === j.jobId));

  return (
    <li className="py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">{t(service.name)}</p>
          <p className="text-sm text-muted">
            {offered
              ? t("{count} jobs, from {price}", {
                  count: doneJobs.length,
                  price: formatPrice(Math.min(...doneJobs.map((j) => j.minPrice))),
                })
              : t("Not offered")}
          </p>
        </div>
        <button type="button" onClick={toggle} aria-expanded={open} className={offered ? "btn-outline" : "btn-primary"}>
          {open ? t("Close") : offered ? t("Change prices") : t("Add")}
        </button>
      </div>

      {open && (
        <form onSubmit={save} className="mt-4 rounded-xl bg-paper p-4" noValidate>
          <ul className="grid gap-3">
            {service.jobs.map((job) => {
              const price = prices[job.id];
              return (
                <li key={job.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex flex-1 items-center gap-2.5 text-[15px]">
                    <input
                      type="checkbox"
                      className="size-4 accent-green"
                      checked={price.on}
                      onChange={(e) => setJob(job.id, { on: e.target.checked })}
                    />
                    <span>
                      {t(job.name)}
                      {job.isCheckup && <span className="block text-xs text-muted">{t("Your visit charge")}</span>}
                    </span>
                  </label>
                  {price.on && (
                    <div className="flex items-center gap-2 sm:pl-0">
                      <PriceInput
                        label={job.isCheckup ? t("Visit charge") : t("Lowest price")}
                        placeholder={job.isCheckup ? t("Visit charge") : t("From")}
                        value={price.min}
                        onChange={(value) => setJob(job.id, { min: value })}
                      />
                      {!job.isCheckup && (
                        <>
                          <span className="text-sm text-muted">{t("to")}</span>
                          <PriceInput
                            label={t("Highest price")}
                            placeholder={t("Up to")}
                            value={price.max}
                            onChange={(value) => setJob(job.id, { max: value })}
                          />
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {t("Leave “Up to” empty for a fixed price. A range can go up to 3 times the lowest price, for example ₹300 to ₹900.")}
          </p>
          {error && (
            <div className="mt-3">
              <FieldError>{error}</FieldError>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t("Saving") : t("Save prices")}
            </button>
            {offered && (
              <button type="button" onClick={remove} disabled={saving} className="btn-quiet text-danger">
                {t("Stop offering this service")}
              </button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

// ₹ box for one price
function PriceInput({ label, placeholder, value, onChange }) {
  return (
    <div className="flex min-w-0 flex-1 sm:w-32 sm:flex-none">
      <span className="flex items-center rounded-l-lg border border-r-0 border-line bg-sand px-2.5 text-[15px] text-muted sm:px-3">
        ₹
      </span>
      <input
        aria-label={label}
        inputMode="numeric"
        maxLength={6}
        className="input min-w-0 rounded-l-none px-2.5 sm:px-3.5"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
    </div>
  );
}
