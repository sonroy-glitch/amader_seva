import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Loading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useLang } from "../lib/i18n.jsx";

const HOLD_SECONDS = 5 * 60;

export default function Book() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, num, formatDate, formatPriceRange, slotLabel } = useLang();
  const providerId = Number(params.get("providerId"));
  const serviceId = Number(params.get("serviceId"));
  const date = params.get("date");
  const slot = params.get("slot");

  const [provider, setProvider] = useState(null);
  const [hold, setHold] = useState(null);
  const [state, setState] = useState("holding"); // holding | held | expired | taken | failed
  const [holdError, setHoldError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);

  const [address, setAddress] = useState({
    house: "",
    area: "",
    landmark: "",
    city: "",
    pincode: params.get("pincode") || "",
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [problem, setProblem] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const holdRef = useRef(null);
  const mounted = useRef(false);
  const started = useRef(false);

  function releaseHold() {
    if (holdRef.current) {
      api(`/bookings/${holdRef.current}/hold`, { method: "DELETE" }).catch(() => {});
      holdRef.current = null;
    }
  }

  async function holdSlot() {
    setState("holding");
    setHoldError("");
    try {
      const data = await api("/bookings/hold", { method: "POST", body: { providerId, serviceId, date, slot } });
      holdRef.current = data.booking.id;
      // Left the page before the hold came back
      if (!mounted.current) return releaseHold();
      setHold(data.booking);
      setState("held");
    } catch (e) {
      setHoldError(e.message);
      setState(e.status === 409 ? "taken" : "failed");
    }
  }

  // Hold the slot when the page opens, release it when the customer leaves
  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      holdSlot();
      api(`/providers/${providerId}`)
        .then((data) => setProvider(data.provider))
        .catch(() => {});
      api("/addresses")
        .then((data) => setSavedAddresses(data.addresses))
        .catch(() => {});
    }
    return () => {
      mounted.current = false;
      releaseHold();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the page opens
  }, []);

  // Countdown
  useEffect(() => {
    if (state !== "held" || !hold) return;
    function tick() {
      const left = Math.max(0, Math.round((new Date(hold.heldUntil) - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        holdRef.current = null;
        setState("expired");
      }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state, hold]);

  async function handleConfirm(e) {
    e.preventDefault();
    if (!jobId) return setFormError("Choose what needs doing");
    if (!address.house.trim()) return setFormError("Enter your house or flat number");
    if (address.area.trim().length < 3) return setFormError("Enter your street and area");
    if (address.city.trim().length < 2) return setFormError("Enter your city or town");
    if (!/^\d{6}$/.test(address.pincode)) return setFormError("Enter a 6-digit pincode");
    setFormError("");
    setSaving(true);
    try {
      await api(`/bookings/${hold.id}/confirm`, {
        method: "POST",
        body: { ...address, jobId, problem: problem.trim() || undefined },
      });
      holdRef.current = null;
      navigate("/bookings", { replace: true, state: { booked: true } });
    } catch (e) {
      if (e.message.includes("expired")) {
        holdRef.current = null;
        setState("expired");
      } else {
        setFormError(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const service = provider?.services.find((s) => s.serviceId === serviceId);
  const serviceName = service?.name;
  const jobs = service?.jobs || [];
  const chosenJob = jobs.find((j) => j.jobId === jobId);
  // Repair services have a "Not sure, needs checking" visit; parts and materials are extra there
  const isRepair = jobs.some((j) => j.isCheckup);
  const backToResults = -1;

  // While the slot is kept, ask before leaving (leaving releases the slot)
  function goBack() {
    if (state === "held" && !window.confirm(t("Leave this page? The slot kept for you will be released."))) return;
    navigate(backToResults);
  }

  if (!providerId || !serviceId || !date || !slot) {
    return (
      <div className="container-page py-16">
        <Alert>This booking link is incomplete. Start again from the search.</Alert>
        <Link to="/" className="btn-outline mt-6">
          {t("Go to search")}
        </Link>
      </div>
    );
  }

  const percentLeft = (secondsLeft / HOLD_SECONDS) * 100;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const runningOut = secondsLeft <= 60;

  return (
    <div className="container-page pt-8 sm:pt-12">
      <button onClick={goBack} className="btn-quiet -ml-3 mb-4">
        {t("Back")}
      </button>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("Book this provider")}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <aside className="lg:order-2 lg:col-span-5">
          <div className="card overflow-hidden lg:sticky lg:top-24">
            {state === "held" && (
              <div className="border-b border-line bg-marigold-soft/60 px-5 py-4 sm:px-6">
                <div className="h-1.5 overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full transition-[width] duration-1000 ease-linear motion-reduce:transition-none ${
                      runningOut ? "bg-danger" : "bg-marigold"
                    }`}
                    style={{ width: `${percentLeft}%` }}
                  />
                </div>
                <p className={`mt-2.5 text-sm ${runningOut ? "font-semibold text-danger" : "text-ink"}`}>
                  {t("This slot is kept for you for")}{" "}
                  <span className="font-semibold tabular-nums">{num(`${minutes}:${seconds}`)}</span>
                </p>
              </div>
            )}

            <div className="p-5 sm:p-6">
              <p className="font-display text-2xl font-semibold leading-tight [font-stretch:88%]">
                {provider?.name || t("Loading")}
              </p>
              {provider && <p className="text-sm text-muted">{provider.area}</p>}
              <dl className="mt-5 grid gap-3 text-[15px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("Service")}</dt>
                  <dd className="text-right font-medium">{serviceName ? t(serviceName) : ""}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("Date")}</dt>
                  <dd className="text-right font-medium">{formatDate(date)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("Time")}</dt>
                  <dd className="text-right font-medium">{slotLabel(slot)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">{t("Job")}</dt>
                  <dd className="text-right font-medium">{chosenJob ? t(chosenJob.name) : t("Not chosen yet")}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line pt-3">
                  <dt className="text-muted">{t("Price")}</dt>
                  <dd className="text-right font-display text-xl font-semibold">
                    {chosenJob ? formatPriceRange(chosenJob.minPrice, chosenJob.maxPrice) : "-"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-muted">{t("You pay online on Amader Seva after the work is done.")}</p>
            </div>
          </div>
        </aside>

        <div className="lg:order-1 lg:col-span-7">
          {state === "holding" && <Loading text="Keeping this slot for you" />}

          {state === "taken" && (
            <div className="card p-6">
              <h2 className="text-2xl font-semibold">{t("Someone else just took this slot")}</h2>
              <p className="mt-2 text-muted">{t(holdError)}</p>
              <button onClick={() => navigate(backToResults)} className="btn-primary mt-6">
                {t("Choose another")}
              </button>
            </div>
          )}

          {state === "failed" && (
            <div className="card p-6">
              <h2 className="text-2xl font-semibold">{t("This slot can't be booked")}</h2>
              <p className="mt-2 text-muted">{t(holdError)}</p>
              <button onClick={() => navigate(backToResults)} className="btn-primary mt-6">
                {t("Go back")}
              </button>
            </div>
          )}

          {state === "expired" && (
            <div className="card p-6">
              <h2 className="text-2xl font-semibold">{t("Your 5 minutes ran out")}</h2>
              <p className="mt-2 text-muted">
                {t("The slot was released so others could book it. If it is still free, you can keep it again.")}
              </p>
              <button onClick={holdSlot} className="btn-primary mt-6">
                {t("Keep this slot again")}
              </button>
            </div>
          )}

          {state === "held" && (
            <form onSubmit={handleConfirm} className="grid gap-6" noValidate>
              <fieldset>
                <legend className="mb-3 text-lg font-semibold">{t("What needs doing?")}</legend>
                {jobs.length === 0 ? (
                  <Loading />
                ) : (
                  <div className="grid gap-2">
                    {jobs.map((job) => {
                      const chosen = job.jobId === jobId;
                      return (
                        <label
                          key={job.jobId}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3.5 text-[15px] transition-colors ${
                            chosen ? "border-green bg-green-soft ring-1 ring-green" : "border-line bg-card hover:border-ink/30"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="job"
                              className="size-4 accent-green"
                              checked={chosen}
                              onChange={() => setJobId(job.jobId)}
                            />
                            <span>
                              <span className="block font-medium">{t(job.name)}</span>
                              {job.isCheckup && (
                                <span className="block text-sm text-muted">{t("They check and tell you the price before starting")}</span>
                              )}
                            </span>
                          </span>
                          <span className="whitespace-nowrap font-semibold">{formatPriceRange(job.minPrice, job.maxPrice)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted">
                  {isRepair
                    ? t("Final price depends on the actual work. Parts or materials are charged extra at cost.")
                    : t("Final price depends on the actual work.")}{" "}
                  {chosenJob?.isCheckup && t("If you go ahead with the work, you don't pay the visit charge on top.")}
                </p>
              </fieldset>

              {savedAddresses.length > 0 && (
                <fieldset>
                  <legend className="mb-3 text-lg font-semibold">{t("Your saved addresses")}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {savedAddresses.map((saved) => {
                      const chosen = ["house", "area", "landmark", "city", "pincode"].every((key) => saved[key] === address[key]);
                      return (
                        <button
                          key={saved.id}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => setAddress({ house: saved.house, area: saved.area, landmark: saved.landmark, city: saved.city, pincode: saved.pincode })}
                          className={`rounded-xl border p-3.5 text-left text-sm transition-colors ${
                            chosen ? "border-green bg-green-soft ring-1 ring-green" : "border-line bg-card hover:border-ink/30"
                          }`}
                        >
                          <span className="block font-semibold">{saved.house}</span>
                          <span className="block text-muted">
                            {saved.area}, {saved.city} - {saved.pincode}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-sm text-muted">{t("Pick one to fill the form, or type a new address below.")}</p>
                </fieldset>
              )}

              <fieldset className="grid gap-4">
                <legend className="mb-1 text-lg font-semibold">{t("Where should they come?")}</legend>
                <AddressInput
                  id="house"
                  label="House or flat number, building"
                  placeholder="For example: Flat 3B, Green Park Apartments"
                  autoComplete="address-line1"
                  value={address.house}
                  onChange={(value) => setAddress({ ...address, house: value })}
                />
                <AddressInput
                  id="area"
                  label="Street and area"
                  placeholder="For example: 12 Lake Road, Salt Lake Sector 1"
                  autoComplete="address-line2"
                  value={address.area}
                  onChange={(value) => setAddress({ ...address, area: value })}
                />
                <AddressInput
                  id="landmark"
                  label="Landmark"
                  optional
                  placeholder="For example: opposite the post office"
                  value={address.landmark}
                  onChange={(value) => setAddress({ ...address, landmark: value })}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AddressInput
                    id="city"
                    label="City or town"
                    placeholder="For example: Durgapur"
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={(value) => setAddress({ ...address, city: value })}
                  />
                  <AddressInput
                    id="book-pincode"
                    label="Pincode"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    value={address.pincode}
                    onChange={(value) => setAddress({ ...address, pincode: value.replace(/\D/g, "") })}
                  />
                </div>
              </fieldset>
              <div>
                <label htmlFor="problem" className="label">
                  {t("Anything else they should know")} <span className="font-normal text-muted">{t("(optional)")}</span>
                </label>
                <textarea
                  id="problem"
                  rows={4}
                  maxLength={500}
                  className="input resize-y"
                  placeholder={t("For example: kitchen tap is leaking and the bathroom switch board sparks")}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                />
              </div>
              {formError && <Alert>{formError}</Alert>}
              <div>
                <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-8">
                  {saving ? t("Sending") : t("Send booking request")}
                </button>
                <p className="mt-3 text-sm text-muted">
                  {t("Once they accept, you will see their phone number and they will see yours.")}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// One labelled box of the address form
function AddressInput({ id, label, optional, placeholder, value, onChange, ...rest }) {
  const { t } = useLang();
  return (
    <div>
      <label htmlFor={id} className="label">
        {t(label)} {optional && <span className="font-normal text-muted">{t("(optional)")}</span>}
      </label>
      <input
        id={id}
        className="input"
        placeholder={placeholder ? t(placeholder) : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}
