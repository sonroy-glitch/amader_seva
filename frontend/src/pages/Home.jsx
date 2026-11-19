import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import SearchForm from "../components/SearchForm.jsx";
import { Alert } from "../components/ui.jsx";
import { useServices } from "../lib/useServices.js";
import { BENGALI_NAMES } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";

import heroElectrician from "../assets/images/hero-electrician.webp";
import heroPlumber from "../assets/images/hero-plumber.webp";
import heroPurohit from "../assets/images/hero-purohit.webp";
import providerPhoto from "../assets/images/provider.webp";
import { SERVICE_PHOTOS as PHOTOS } from "../lib/photos.js";

// Different photos from the service cards below, in the order of the headline
const HERO_PHOTOS = [
  ["Electrician", heroElectrician],
  ["Plumber", heroPlumber],
  ["Purohit", heroPurohit],
];

const PROMISES = [
  "Every provider is checked by us",
  "See the rate before you book",
  "Pay only after the work is done",
];

const STEPS = [
  {
    title: "Pick a person and a time",
    text: "See who is free in your pincode for the morning, afternoon or evening, with their rate.",
  },
  {
    title: "Send a request",
    text: "The slot is kept for you for 5 minutes while you add your address and describe the job.",
  },
  {
    title: "They accept the job",
    text: "The provider gets an email and accepts. Then you both get each other's phone number to sort out the details.",
  },
  {
    title: "Pay after the work",
    text: "When the job is done, pay the agreed rate online on Amader Seva.",
  },
];

const REASONS = [
  {
    title: "Checked before they show up",
    text: "We look at every provider profile before it appears in search. Profiles that are not genuine are taken down.",
  },
  {
    title: "The rate is fixed up front",
    text: "Each provider sets a rate for every service. You see it before you send a request, and that is the rate you pay.",
  },
  {
    title: "No advance payment",
    text: "Nothing is paid before the job. Once the work is finished, you pay the agreed rate online on Amader Seva.",
  },
  {
    title: "Track every booking",
    text: "See when the provider accepts your request, and find your past bookings and saved addresses in your account.",
  },
];

export default function Home() {
  const { services, loading, error } = useServices();
  const { t } = useLang();
  const [serviceId, setServiceId] = useState("");
  const formRef = useRef(null);

  function chooseService(id) {
    setServiceId(String(id));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(
      () => document.getElementById("pincode")?.focus({ preventScroll: true }),
      400,
    );
  }

  return (
    <>
      <section className="container-page grid gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-10 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-7">
          <h1 className="text-[40px] font-medium leading-[1.02] tracking-tight sm:text-[56px] lg:text-[60px]">
            {t("The electrician, the plumber, the purohit.")}{" "}
            <span className="text-green">
              {t("Booked for a time that suits you.")}
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
            {t(
              "Compare verified people who work in your area, see what they charge before you book, and pay online on Amader Seva once the work is done.",
            )}
          </p>
          <ul className="mt-6 grid gap-2.5">
            {PROMISES.map((text) => (
              <li key={text} className="flex items-center gap-3 font-semibold">
                <CheckIcon />
                {t(text)}
              </li>
            ))}
          </ul>
        </div>

        <div
          ref={formRef}
          className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <div className="card p-5 shadow-[0_1px_0_rgba(29,43,37,0.04),0_12px_32px_-12px_rgba(29,43,37,0.12)] sm:p-7">
            <h2 className="text-2xl font-semibold">
              {t("Find someone near you")}
            </h2>
            <p className="mb-6 mt-1 text-sm text-muted">
              {t("Available every day of the week, including Sundays.")}
            </p>
            <Alert>{error}</Alert>
            <SearchForm
              services={services}
              serviceId={serviceId}
              onServiceChange={setServiceId}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:col-span-7">
          {HERO_PHOTOS.map(([name, src]) => (
            <figure key={name}>
              <img
                src={src}
                alt=""
                width="480"
                height="600"
                className="aspect-[4/5] w-full rounded-2xl bg-sand object-cover"
              />
              <figcaption className="mt-2 text-sm font-semibold text-muted">
                {t(name)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Services with a photo each */}
      <section className="border-y border-line bg-card/60">
        <div className="container-page py-16 lg:py-20">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("What do you need done?")}
            </h2>
            <p className="text-muted">
              {t("Choose one to start your search.")}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Plain placeholder cards while the list loads, so the section keeps its shape */}
            {loading &&
              [1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  aria-hidden="true"
                  className="overflow-hidden rounded-2xl border border-line bg-paper"
                >
                  <div className="aspect-[16/10] bg-sand" />
                  <div className="space-y-3 p-5">
                    <div className="h-7 w-1/2 rounded bg-sand" />
                    <div className="h-4 w-3/4 rounded bg-sand" />
                    <div className="h-4 w-1/3 rounded bg-sand" />
                  </div>
                </div>
              ))}
            {services.map((service) => {
              // In Bengali the big name often says it already, so show the full name only when it adds something
              const fullName = t(service.name);
              const showName = fullName !== BENGALI_NAMES[service.name];
              const selected = serviceId === String(service.id);
              return (
                <button
                  key={service.id}
                  onClick={() => chooseService(service.id)}
                  className={`group overflow-hidden rounded-2xl border bg-paper text-left transition-colors ${
                    selected
                      ? "border-green ring-1 ring-green"
                      : "border-line hover:border-ink/30"
                  }`}
                >
                  {PHOTOS[service.name] ? (
                    <img
                      src={PHOTOS[service.name]}
                      alt=""
                      width="640"
                      height="400"
                      loading="lazy"
                      className="aspect-[16/10] w-full bg-sand object-cover"
                    />
                  ) : (
                    <span className="block aspect-[16/10] w-full bg-sand" />
                  )}
                  <span className="block p-5">
                    <span
                      lang="bn"
                      className="block font-display text-[26px] font-semibold leading-tight text-green"
                    >
                      {BENGALI_NAMES[service.name] || service.name}
                    </span>
                    {showName && (
                      <span className="mt-2 block font-semibold">
                        {fullName}
                      </span>
                    )}
                    {service.description && (
                      <span className="mt-1 block text-sm text-muted">
                        {t(service.description)}
                      </span>
                    )}
                    <span className="mt-4 block text-sm font-semibold text-green group-hover:underline">
                      {t("Find near me")} →
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="container-page py-16 lg:py-24">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("How a booking works")}
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border-t-2 border-ink/80 pt-4">
              <span className="font-display text-sm font-semibold text-marigold">
                {t("Step {n}", { n: i + 1 })}
              </span>
              <h3 className="mt-2 text-xl font-semibold">{t(step.title)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {t(step.text)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why book here */}
      <section className="border-y border-line bg-card/60">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-12 lg:gap-12 lg:py-20">
          <div className="lg:col-span-4">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("Why book through Amader Seva")}
            </h2>
            <p className="mt-4 text-muted">
              {t(
                "Local people you can trust, clear prices, and no money changing hands before the job is done.",
              )}
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-8">
            {REASONS.map((reason) => (
              <div key={reason.title} className="flex gap-4">
                <CheckIcon />
                <div>
                  <dt className="text-lg font-semibold">{t(reason.title)}</dt>
                  <dd className="mt-1 text-[15px] leading-relaxed text-muted">
                    {t(reason.text)}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* For providers */}
      <section className="container-page pt-16 lg:pt-24">
        <div className="grid overflow-hidden rounded-3xl bg-green text-paper lg:grid-cols-12">
          <div className="px-6 py-10 sm:px-10 sm:py-14 lg:col-span-7">
            <h2 className="text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
              {t("Do you do this work yourself?")}
            </h2>
            <p className="mt-3 max-w-xl text-paper/80">
              {t(
                "Make a profile, choose the time slots you take and set your own rate for each service. We check every profile before it goes live, and customers pay online on Amader Seva once the job is done.",
              )}
            </p>
            <ul className="mt-6 grid gap-2.5 font-semibold">
              {[
                "No fee to join",
                "Get an email for every new job request",
                "Accept only the jobs that suit you",
              ].map((text) => (
                <li key={text} className="flex items-center gap-3">
                  <CheckIcon />
                  {t(text)}
                </li>
              ))}
            </ul>
            <Link
              to="/register?role=PROVIDER"
              className="btn mt-8 bg-paper text-green hover:bg-card"
            >
              {t("Join as a provider")}
            </Link>
          </div>
          <img
            src={providerPhoto}
            alt=""
            width="800"
            height="600"
            loading="lazy"
            className="h-64 w-full bg-green-dark object-cover sm:h-80 lg:col-span-5 lg:h-full"
          />
        </div>
        <p className="mt-4 text-xs text-muted">
          {t("Photos from")}{" "}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Unsplash
          </a>
        </p>
      </section>
    </>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 self-start rounded-full bg-green-soft p-1 text-green"
    >
      <path
        d="M4 10.5l4 4 8-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
