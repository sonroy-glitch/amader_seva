import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, BookingSteps, Loading, StatusBadge } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import SlotPicker from "../components/SlotPicker.jsx";
import { formatPhone, lastBookableDay, nowInIndia, slotStarted } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { SERVICE_PHOTOS } from "../lib/photos.js";

const CUSTOMER_STEPS = ["Pick a person and a time", "Send a request", "They accept the job", "Pay after the work"];

const PROVIDER_TIPS = [
  "Reply to new requests within 24 hours. If you don't, the request closes on its own.",
  "Call the customer once you accept, to sort out the details.",
  "When you reach the customer, ask for their 4-digit start code and enter it here before you begin.",
  "Mark the job completed only after the work is done.",
  "The customer pays online on Amader Seva after the work.",
];

export default function MyBookings() {
  const { user } = useAuth();
  const isProvider = user.role === "PROVIDER";
  const { t, num } = useLang();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  // Set by the booking page right after a booking goes through
  const [justBooked] = useState(location.state?.booked === true);

  // Clear the flag so a refresh doesn't show the message again
  useEffect(() => {
    if (location.state?.booked) navigate(location.pathname, { replace: true, state: null });
  }, []);

  function load() {
    api("/bookings/my")
      .then((data) => setBookings(data.bookings))
      .catch((e) => setError(e.message));
  }

  // Load now, then again every 30 seconds so new replies show without a refresh
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  if (error) {
    return (
      <div className="container-page py-16">
        <Alert>{error}</Alert>
      </div>
    );
  }
  if (!bookings) return <div className="container-page"><Loading /></div>;

  // Providers see new requests on their own; customers see them with upcoming
  const requests = bookings.filter((b) => b.status === "PENDING");
  const confirmed = bookings.filter((b) => b.status === "CONFIRMED");
  const upcoming = isProvider ? confirmed : [...requests, ...confirmed];
  const past = bookings.filter((b) => ["COMPLETED", "CANCELLED", "EXPIRED"].includes(b.status));
  const completed = bookings.filter((b) => b.status === "COMPLETED");

  const counts = [
    [isProvider ? "New requests" : "Waiting for reply", requests.length],
    ["Confirmed", confirmed.length],
    ["Completed", completed.length],
  ];

  return (
    <>
      {/* Top band with a soft dotted pattern and the counts */}
      <div className="relative overflow-hidden border-b border-line bg-card/70">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-70 [mask-image:linear-gradient(to_left,black,transparent_70%)]"
          style={{ backgroundImage: "radial-gradient(var(--color-line) 1.2px, transparent 1.2px)", backgroundSize: "16px 16px" }}
        />
        <div className="container-page relative flex flex-col gap-8 py-10 sm:py-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-green">
              {t("Hello, {name}", { name: user.name.split(" ")[0] })}
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              {isProvider ? t("Your jobs") : t("Your bookings")}
            </h1>
            <p className="mt-2 max-w-md text-muted">
              {isProvider
                ? t("New requests, upcoming work and past jobs, all in one place.")
                : t("Follow every booking from request to finished work.")}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[26rem]">
            {counts.map(([label, value]) => (
              <div key={label} className="flex flex-col justify-between rounded-xl border border-line bg-paper/80 px-3 py-3 sm:px-4">
                <dt className="text-xs text-muted sm:text-sm">{t(label)}</dt>
                <dd className="mt-0.5 font-display text-3xl font-semibold">{num(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="container-page grid gap-10 pt-2 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-8">
          {justBooked && (
            <div className="mt-8">
              <Alert tone="success">
                <p className="font-semibold">{t("Booked successfully")}</p>
                <p className="mt-0.5">{t("We have told the provider. You will see their reply here, and we will email you too.")}</p>
              </Alert>
            </div>
          )}
          {bookings.length === 0 ? (
            <EmptyState isProvider={isProvider} />
          ) : (
            <>
              {isProvider && (
                <Section title="New requests" empty="No new requests." bookings={requests} isProvider={isProvider} onChange={load} />
              )}
              <Section title="Upcoming" empty="No upcoming bookings." bookings={upcoming} isProvider={isProvider} onChange={load} />
              <Section title="Past" empty="No past bookings." bookings={past} isProvider={isProvider} onChange={load} />
            </>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="grid gap-4 lg:sticky lg:top-24 lg:mt-10">
            {isProvider ? <ProviderSide /> : <CustomerSide />}
          </div>
        </aside>
      </div>
    </>
  );
}

function EmptyState({ isProvider }) {
  const { t } = useLang();
  return (
    <div className="card mt-10 overflow-hidden">
      {!isProvider && (
        <div className="grid grid-cols-3 gap-1 bg-sand">
          {["Electrician", "Plumber", "Maid"].map((name) => (
            <img key={name} src={SERVICE_PHOTOS[name]} alt="" width="640" height="400" className="aspect-[16/10] w-full object-cover" />
          ))}
        </div>
      )}
      <div className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">{t("Nothing here yet")}</h2>
        {isProvider ? (
          <>
            <p className="mt-2 text-muted">
              {t("Bookings from customers show up here. Make sure your profile, rates and times are filled in.")}
            </p>
            <Link to="/provider" className="btn-primary mt-6">
              {t("Go to my profile")}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted">{t("When you book someone, the booking and their phone number show up here.")}</p>
            <Link to="/" className="btn-primary mt-6">
              {t("Find help")}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// Right column for customers: book again, and how a booking moves
function CustomerSide() {
  const { t, num } = useLang();
  return (
    <>
      <div className="overflow-hidden rounded-2xl bg-green text-paper">
        <div className="grid grid-cols-3">
          {["Plumber", "Purohit", "AC/Fridge/TV Mechanic"].map((name) => (
            <img key={name} src={SERVICE_PHOTOS[name]} alt="" width="640" height="400" loading="lazy" className="aspect-square w-full object-cover" />
          ))}
        </div>
        <div className="p-5">
          <p className="text-lg font-semibold">{t("Need help with something else?")}</p>
          <p className="mt-1 text-sm text-paper/80">{t("Electricians, plumbers, maids and more, checked by us.")}</p>
          <Link to="/" className="btn mt-4 bg-paper text-green hover:bg-card">
            {t("Find help")}
          </Link>
        </div>
      </div>

      <div className="card p-5">
        <p className="font-semibold">{t("How a booking works")}</p>
        <ol className="mt-4 grid gap-3">
          {CUSTOMER_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-[15px]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-soft font-display text-sm font-semibold text-green">
                {num(i + 1)}
              </span>
              {t(step)}
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
          {t("When the job is done, pay the agreed rate online on Amader Seva.")}
        </p>
        <p className="mt-2 text-sm text-muted">
          {t("Give your start code to the provider only when they arrive. Without it they can't start the work.")}
        </p>
      </div>
    </>
  );
}

// Right column for providers: profile link and simple tips
function ProviderSide() {
  const { t } = useLang();
  return (
    <>
      <div className="rounded-2xl bg-green p-5 text-paper">
        <p className="text-lg font-semibold">{t("Your profile")}</p>
        <p className="mt-1 text-sm text-paper/80">{t("Keep your times and rates up to date so customers can book you.")}</p>
        <Link to="/provider" className="btn mt-4 bg-paper text-green hover:bg-card">
          {t("Go to my profile")}
        </Link>
      </div>

      <div className="card p-5">
        <p className="font-semibold">{t("Good to know")}</p>
        <ul className="mt-3 grid gap-3">
          {PROVIDER_TIPS.map((tip) => (
            <li key={tip} className="flex gap-3 text-[15px] leading-snug">
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-marigold" />
              {t(tip)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function Section({ title, empty, bookings, isProvider, onChange }) {
  const { t, num } = useLang();
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-3 text-xl font-semibold">
        {t(title)}
        <span className="rounded-full bg-sand px-2.5 py-0.5 text-sm font-semibold text-muted">{num(bookings.length)}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </h2>
      {bookings.length === 0 ? (
        <p className="mt-3 text-muted">{t(empty)}</p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {bookings.map((b) => (
            <BookingCard key={b.id} booking={b} isProvider={isProvider} onChange={onChange} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingCard({ booking, isProvider, onChange }) {
  const { t, formatDate, formatDateTime, formatPriceRange, slotLabel } = useLang();
  const [action, setAction] = useState(""); // "" | cancel | complete | reschedule | noshow | codeproblem
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState(booking.date.slice(0, 10));
  const [newSlot, setNewSlot] = useState("");
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");

  const otherName = isProvider ? booking.customerName : booking.providerName;
  const phone = isProvider ? booking.customerPhone : booking.providerPhone;
  const isPending = booking.status === "PENDING";
  const isConfirmed = booking.status === "CONFIRMED";
  const isCompleted = booking.status === "COMPLETED";
  const isExpired = booking.status === "EXPIRED";
  const isCancelled = booking.status === "CANCELLED";
  const day = booking.date.slice(0, 10);
  // The provider entered the customer's start code (so they really came)
  const workStarted = Boolean(booking.startedAt);
  // Once the work time has come, only the provider can cancel (same rule as the server)
  const started = day < nowInIndia().today || slotStarted(day, booking.slot);
  const canCancel = (isPending || isConfirmed) && !workStarted && !started;
  const firstName = otherName.split(" ")[0];
  // After a request closes, search the same time again if it has not started yet
  const searchAgain =
    day >= nowInIndia().today && !slotStarted(day, booking.slot)
      ? `/search?${new URLSearchParams({ serviceId: booking.serviceId, pincode: booking.pincode, date: day, slot: booking.slot })}`
      : "/";
  const canComplete = isProvider && isConfirmed && workStarted;
  const canReportNoShow = !isProvider && booking.canReportNoShow;
  // A provider dropping a job they accepted must say why
  const needsReason = isProvider && isConfirmed;

  async function run(path, body) {
    setError("");
    setSaving(true);
    try {
      await api(`/bookings/${booking.id}/${path}`, { method: "POST", body });
      setAction("");
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
          <p className="font-display text-2xl font-semibold leading-tight [font-stretch:88%]">{t(booking.service)}</p>
          <p className="mt-1 text-[15px] text-ink/85">
            {formatDate(booking.date)}, {slotLabel(booking.slot).toLowerCase()}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {!isProvider && (
        <div className="mt-5">
          <BookingSteps status={booking.status} />
        </div>
      )}

      <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-[15px] sm:grid-cols-2">
        <div>
          <dt className="text-muted">{isProvider ? t("Customer") : t("Provider")}</dt>
          <dd className="font-semibold">{otherName}</dd>
          {phone && (
            <a href={`tel:+91${phone}`} className="font-semibold text-green hover:text-green-dark hover:underline">
              {formatPhone(phone)}
            </a>
          )}
        </div>
        <div>
          <dt className="text-muted">{booking.job ? t("Job and price") : t("Price")}</dt>
          <dd className="font-semibold">
            {booking.job && <span className="block">{t(booking.job)}</span>}
            {formatPriceRange(booking.agreedPrice, booking.maxPrice)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted">{t("Address")}</dt>
          <dd className="whitespace-pre-line">{booking.address}</dd>
        </div>
        {booking.problem && (
          <div className="sm:col-span-2">
            <dt className="text-muted">{t("Work needed")}</dt>
            <dd className="whitespace-pre-line">{booking.problem}</dd>
          </div>
        )}
      </dl>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {action === "cancel" && (
        <div className="mt-5 rounded-lg bg-danger-soft/60 p-4">
          <p className="text-[15px]">
            {isProvider && isPending
              ? t("Decline this request? The customer will get an email.")
              : t("Cancel this booking? {who} will get an email.", { who: isProvider ? t("The customer") : otherName })}
          </p>
          {needsReason && (
            <>
              <label htmlFor={`reason-${booking.id}`} className="label mt-3">
                {t("Why can't you come?")}
              </label>
              <textarea
                id={`reason-${booking.id}`}
                className="input"
                rows="2"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <p className="mt-1 text-sm text-muted">{t("The customer will see this. We keep a count of jobs cancelled after accepting.")}</p>
            </>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() =>
                needsReason && reason.trim().length < 5
                  ? setError("Please tell the customer why you can't come")
                  : run("cancel", needsReason ? { reason } : undefined)
              }
              disabled={saving}
              className="btn-danger"
            >
              {saving ? t("Cancelling") : isProvider && isPending ? t("Yes, decline") : t("Yes, cancel booking")}
            </button>
            <button onClick={() => setAction("")} disabled={saving} className="btn-quiet">
              {t("Keep booking")}
            </button>
          </div>
        </div>
      )}

      {action === "complete" && (
        <div className="mt-5 rounded-lg bg-green-soft p-4">
          <p className="text-[15px]">{t("Is the work finished? The customer will see it as completed and get an email.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => run("complete")} disabled={saving} className="btn-primary">
              {saving ? t("Saving") : t("Yes, work is done")}
            </button>
            <button onClick={() => setAction("")} disabled={saving} className="btn-quiet">
              {t("Not yet")}
            </button>
          </div>
        </div>
      )}

      {action === "reschedule" && (
        <div className="mt-5 rounded-lg bg-sand p-4">
          <label htmlFor={`date-${booking.id}`} className="label">
            {t("New date")}
          </label>
          <input
            id={`date-${booking.id}`}
            type="date"
            className="input"
            min={nowInIndia().today}
            max={lastBookableDay()}
            value={newDate}
            onChange={(e) => {
              setNewDate(e.target.value);
              setNewSlot("");
            }}
          />
          <p className="label mt-4">{t("New time")}</p>
          <SlotPicker date={newDate} value={newSlot} onChange={setNewSlot} allowed={booking.providerSlots} compact />
          <p className="mt-3 text-sm text-muted">
            {t("{name} will need to accept the new time again.", { name: otherName.split(" ")[0] })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => (newSlot ? run("reschedule", { date: newDate, slot: newSlot }) : setError("Choose a time"))}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? t("Saving") : t("Save new time")}
            </button>
            <button onClick={() => setAction("")} disabled={saving} className="btn-quiet">
              {t("Back")}
            </button>
          </div>
        </div>
      )}

      {action === "noshow" && (
        <div className="mt-5 rounded-lg bg-danger-soft/60 p-4">
          <p className="text-[15px]">
            {t("Did {name} not come at all? The booking will be cancelled and we will look into it.", { name: firstName })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => run("no-show")} disabled={saving} className="btn-danger">
              {saving ? t("Saving") : t("Yes, they didn't come")}
            </button>
            <button onClick={() => setAction("")} disabled={saving} className="btn-quiet">
              {t("Back")}
            </button>
          </div>
        </div>
      )}

      {action === "codeproblem" && (
        <div className="mt-5 rounded-lg bg-marigold-soft p-4">
          <p className="text-[15px]">
            {t("Are you at the customer's place and they won't give the code? We will call you both and sort it out.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => run("code-problem")} disabled={saving} className="btn-primary">
              {saving ? t("Saving") : t("Yes, ask for help")}
            </button>
            <button onClick={() => setAction("")} disabled={saving} className="btn-quiet">
              {t("Back")}
            </button>
          </div>
        </div>
      )}

      {/* Customer: the code to give the provider on arrival */}
      {!isProvider && booking.startCode && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg bg-marigold-soft p-4">
          <div>
            <p className="text-sm text-muted">{t("Start code")}</p>
            <p className="font-display text-3xl font-semibold tracking-[0.3em]">{booking.startCode}</p>
          </div>
          <p className="min-w-48 flex-1 text-[15px]">
            {t("Give this to {name} when they arrive, not before. They need it to start the work.", { name: firstName })}
          </p>
        </div>
      )}

      {/* Provider: enter the customer's code on arrival */}
      {isProvider && booking.canStart && action === "" && (
        <div className="mt-5 rounded-lg bg-marigold-soft p-4">
          <label htmlFor={`code-${booking.id}`} className="label">
            {t("Customer's start code")}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id={`code-${booking.id}`}
              className="input w-32 text-center font-display text-xl tracking-[0.3em]"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button onClick={() => run("start", { code })} disabled={saving || code.length !== 4} className="btn-primary">
              {saving ? t("Saving") : t("Start work")}
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">{t("Don't start work until you enter the customer's code.")}</p>
          {booking.codeProblemAt ? (
            <p className="mt-2 text-sm font-semibold">{t("We have been told. We will contact you soon")}</p>
          ) : (
            <button onClick={() => setAction("codeproblem")} className="mt-2 text-sm font-semibold text-green underline hover:text-green-dark">
              {t("Customer didn't give the code")}
            </button>
          )}
        </div>
      )}

      {isProvider && isConfirmed && !workStarted && !booking.canStart && (
        <p className="mt-4 text-sm text-muted">{t("On the day of the job, ask the customer for their start code to begin.")}</p>
      )}

      {isConfirmed && workStarted && (
        <p className="mt-4 rounded-lg bg-green-soft p-3 text-[15px] font-semibold text-green-dark">
          {isProvider ? t("Work started. Mark it completed when the work is done.") : t("Work started.")}
        </p>
      )}

      {!isProvider && isConfirmed && !workStarted && booking.codeProblem && (
        <p className="mt-4 rounded-lg bg-marigold-soft p-3 text-[15px]">
          {t("{name} says they came but did not get the start code. We will call you both to sort this out.", { name: firstName })}
        </p>
      )}

      {!isProvider && isConfirmed && started && !workStarted && !booking.codeProblem && (
        <p className="mt-4 text-sm text-muted">
          {canReportNoShow
            ? t("The booking time is over and the work did not start. If {name} did not come, tell us below.", { name: firstName })
            : t("The work time has started, so this booking can't be changed now")}
        </p>
      )}

      {isCancelled && <CancelNote booking={booking} isProvider={isProvider} name={firstName} searchAgain={searchAgain} />}

      {isCompleted && (
        <p className="mt-4 rounded-lg bg-green-soft p-3 text-[15px] font-semibold text-green-dark">
          {isProvider
            ? t("You marked this work as completed.")
            : t("{name} marked this work as completed.", { name: otherName.split(" ")[0] })}
        </p>
      )}

      {!isProvider && isPending && booking.replyBy && (
        <p className="mt-4 text-sm text-muted">
          {t("{name} has until {time} to reply. We will email you when they do.", {
            name: otherName.split(" ")[0],
            time: formatDateTime(booking.replyBy),
          })}
        </p>
      )}

      {isProvider && isPending && booking.replyBy && (
        <p className="mt-4 rounded-lg bg-marigold-soft p-3 text-[15px]">
          {t("Reply by {time}. If you do not reply by then, the request closes on its own.", {
            time: formatDateTime(booking.replyBy),
          })}
        </p>
      )}

      {isExpired && (
        <div className="mt-4 rounded-lg bg-danger-soft/60 p-3 text-[15px]">
          <p>
            {isProvider
              ? t("You did not reply in time, so this request is closed.")
              : t("{name} did not reply in time, so this request is closed.", { name: otherName.split(" ")[0] })}
          </p>
          {!isProvider && (
            <Link to={searchAgain} className="btn-primary mt-3">
              {t("Book someone else")}
            </Link>
          )}
        </div>
      )}

      {action === "" && (canCancel || canComplete || canReportNoShow) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {isProvider && isPending && (
            <button onClick={() => run("accept")} disabled={saving} className="btn-primary">
              {saving ? t("Saving") : t("Accept job")}
            </button>
          )}
          {canComplete && (
            <button onClick={() => setAction("complete")} className="btn-primary">
              {t("Mark as completed")}
            </button>
          )}
          {!isProvider && canCancel && (
            <button onClick={() => setAction("reschedule")} className="btn-outline">
              {t("Change time")}
            </button>
          )}
          {canCancel && (
            <button onClick={() => setAction("cancel")} className="btn-outline">
              {isProvider && isPending ? t("Decline") : isPending ? t("Cancel request") : t("Cancel booking")}
            </button>
          )}
          {canReportNoShow && (
            <button onClick={() => setAction("noshow")} className="btn-outline">
              {t("Provider didn't come")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

// Who cancelled and why, on a cancelled booking
function CancelNote({ booking, isProvider, name, searchAgain }) {
  const { t } = useLang();
  const by = booking.cancelledBy;
  let text = t("This booking was cancelled.");
  if (by === "CUSTOMER") text = isProvider ? t("{name} cancelled this booking.", { name }) : t("You cancelled this booking.");
  if (by === "DECLINED") text = isProvider ? t("You declined this request.") : t("{name} could not take this request.", { name });
  if (by === "PROVIDER") text = isProvider ? t("You cancelled this booking.") : t("{name} cancelled this booking.", { name });
  if (by === "NO_SHOW")
    text = isProvider ? t("The customer reported that you did not come.") : t("You reported that {name} did not come.", { name });
  if (by === "ADMIN") text = t("Amader Seva cancelled this booking.");
  if (by === "NOT_STARTED") text = t("This booking was closed because the work was never started.");

  return (
    <div className="mt-4 rounded-lg bg-danger-soft/60 p-3 text-[15px]">
      <p>{text}</p>
      {booking.cancelReason && (
        <p className="mt-1">
          <span className="text-muted">{t("Reason")}:</span> {booking.cancelReason}
        </p>
      )}
      {!isProvider && by !== "CUSTOMER" && (
        <Link to={searchAgain} className="btn-primary mt-3">
          {t("Book someone else")}
        </Link>
      )}
    </div>
  );
}
