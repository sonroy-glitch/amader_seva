import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import SearchForm from "../components/SearchForm.jsx";
import { Alert, Loading } from "../components/ui.jsx";
import { api } from "../lib/api.js";
import { useServices } from "../lib/useServices.js";
import { SLOTS } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";

const STEPS = ["Pick a person and a time", "Send a request", "They accept the job", "Pay after the work"];

const PROMISES = ["Every provider is checked by us", "See the rate before you book", "Pay only after the work is done"];

// Keep the "Searching" spinner up at least this long, so people see the search happen
const MIN_SEARCH_MS = 600;

export default function Search() {
  const [params] = useSearchParams();
  const location = useLocation();
  const resultsRef = useRef(null);
  const { services } = useServices();
  const { t, num, formatDate, formatPrice, yearsLabel } = useLang();
  // The result remembers which search it belongs to, so a new search shows loading.
  // Every press of Search is a new page visit (new location.key), even with the same details.
  const [result, setResult] = useState({
    searchKey: "",
    providers: null,
    error: "",
  });
  const query = params.toString();
  const searchKey = location.key;
  const current = result.searchKey === searchKey;
  const providers = current ? result.providers : null;
  const error = current ? result.error : "";
  // Set when the form is changed but Search is not pressed yet (remembers which search it was)
  const [editedFor, setEditedFor] = useState(null);
  const edited = editedFor === query;

  const serviceId = params.get("serviceId") || "";
  const pincode = params.get("pincode") || "";
  const date = params.get("date") || "";
  const slot = params.get("slot") || "";

  useEffect(() => {
    const wait = new Promise((resolve) => setTimeout(resolve, MIN_SEARCH_MS));
    Promise.all([api(`/providers/search?${query}`), wait])
      .then(([data]) => setResult({ searchKey, providers: data.providers, error: "" }))
      .catch((e) => setResult({ searchKey, providers: null, error: e.message }));
  }, [query, searchKey]);

  // On phones the results are below the form, so bring them into view once they are ready
  const searching = !current;
  useEffect(() => {
    if (searching || !window.matchMedia("(max-width: 767px)").matches) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultsRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  }, [searching]);

  const serviceName = services.find((s) => String(s.id) === serviceId)?.name;
  const slotInfo = SLOTS.find((s) => s.value === slot);

  return (
    <div className="container-page pt-8 sm:pt-10">
      <div className="card p-5 sm:p-6">
        <SearchForm
          key={params.toString()}
          services={services}
          initial={{ serviceId, pincode, date, slot }}
          layout="bar"
          onEdit={() => setEditedFor(query)}
          searching={searching}
        />
      </div>

      <div ref={resultsRef} className="mt-8 scroll-mt-20">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {serviceName ? t(serviceName) : t("Search results")}
        </h1>
        {date && slotInfo && (
          <p className="mt-1 text-muted">
            {t("Free on {date}, {slot}, near {pincode}", {
              date: formatDate(date),
              slot: t(slotInfo.label).toLowerCase(),
              pincode,
            })}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          {edited && providers && (
            <p className="mb-4 rounded-xl bg-marigold-soft px-4 py-3 text-[15px]">
              {t("You changed the search. Press Search to see who is free.")}
            </p>
          )}
          {error && <Alert>{error}</Alert>}
          {!error && providers === null && <Loading text="Finding who is free" />}

          {providers && providers.length === 0 && (
            <div className="card px-6 py-14 text-center">
              <h2 className="text-2xl font-semibold">{t("Nobody is free for this time yet")}</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">
                {t("Try a different time slot or another date. We are adding verified people in new areas every week.")}
              </p>
            </div>
          )}

          {providers && providers.length > 0 && (
            <>
              <p className="mb-3 text-sm text-muted">
                {providers.length === 1
                  ? t("1 person available")
                  : t("{count} people available", { count: providers.length })}
              </p>
              <ul className={`grid gap-3 ${edited ? "pointer-events-none opacity-50" : ""}`} aria-disabled={edited}>
                {providers.map((p) => (
                  <li
                    key={p.providerId}
                    className="card flex flex-col gap-5 p-5 transition-colors hover:border-ink/25 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <span
                        aria-hidden="true"
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-green-soft font-display text-xl font-semibold text-green"
                      >
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-2xl font-semibold leading-tight [font-stretch:88%]">
                          {p.name}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm">
                          <span className="rounded-full bg-sand px-2.5 py-0.5">{p.area}</span>
                          <span className="rounded-full bg-sand px-2.5 py-0.5">{yearsLabel(p.experience)}</span>
                          <span className="rounded-full bg-green-soft px-2.5 py-0.5 font-semibold text-green-dark">
                            {t("Verified")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 border-t border-line pt-4 sm:border-0 sm:pt-0">
                      <div className="sm:text-right">
                        <p className="text-xs text-muted">{p.fromPrice ? t("Jobs from") : t("Visit charge")}</p>
                        <p className="mt-1 font-display text-3xl font-semibold leading-none">
                          {formatPrice(p.fromPrice || p.visitCharge)}
                        </p>
                        <p className="mt-1.5 text-xs text-muted">
                          {p.fromPrice && p.visitCharge
                            ? t("Visit charge {price}, pay after the work", { price: formatPrice(p.visitCharge) })
                            : t("pay after the work")}
                        </p>
                      </div>
                      <Link
                        to={`/book?${new URLSearchParams({ providerId: p.providerId, serviceId, date, slot, pincode })}`}
                        className="btn-primary px-7 py-3 text-base"
                      >
                        {t("Book")}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Right side: what happens after you tap Book */}
        <aside className="grid content-start gap-4 lg:col-span-4">
          <div className="card p-5">
            <p className="font-semibold">{t("How a booking works")}</p>
            <ol className="mt-4 grid gap-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-[15px]">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green-soft font-display text-sm font-semibold text-green">
                    {num(i + 1)}
                  </span>
                  {t(step)}
                </li>
              ))}
            </ol>
          </div>
          <ul className="grid gap-2.5 rounded-2xl border border-line p-5 text-[15px]">
            {PROMISES.map((text) => (
              <li key={text} className="flex items-center gap-3">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-marigold" />
                {t(text)}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

// "Sourav Roy" -> "SR", shown in the round badge on each card
function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
