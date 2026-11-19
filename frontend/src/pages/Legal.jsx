import { useLang } from "../lib/i18n.jsx";

const UPDATED = "2026-09-29";

const TERMS = [
  [
    "About Amader Seva",
    "Amader Seva connects you with local workers (providers) such as electricians, plumbers and maids. Providers are independent workers, not employees of Amader Seva.",
  ],
  [
    "Your account",
    "Give your real name, email and mobile number. Keep your password safe. You are responsible for what is done from your account.",
  ],
  [
    "Booking",
    "When you book, the provider gets your request and can accept or decline it. The booking is confirmed only after the provider accepts. Then both of you can see each other's phone number.",
  ],
  [
    "Rates and payment",
    "The rate shown is for one visit. Materials or parts, if needed, are extra and are agreed with the provider. Pay the agreed rate online on Amader Seva after the work is done.",
  ],
  [
    "Changing or cancelling",
    "You can change the time or cancel a booking from your bookings before the work is done. The provider can also decline or cancel. The other person gets an email each time.",
  ],
  [
    "Providers",
    "Providers must give correct details about their work, area and rates. We check every profile before it shows in search. Providers must mark a job completed only after the work is done.",
  ],
  [
    "Blocked accounts",
    "We may block an account that gives false details, misbehaves with customers or providers, or misuses the website.",
  ],
  [
    "Our responsibility",
    "We check providers before listing them, but the work is done by the provider. Amader Seva is not responsible for the quality of the work or any damage during it.",
  ],
  ["Changes to these terms", "We may update these terms. The latest version is always on this page."],
];

const PRIVACY = [
  [
    "What we collect",
    "Your name, email, mobile number and password (stored scrambled, never as plain text). For bookings, the address and work details you give. For providers, the area, pincode, experience, services and rates.",
  ],
  ["How we use it", "To create your account, run your bookings and send you emails about them."],
  [
    "Who can see it",
    "Your phone number is shown only to the person you book with, and only after the provider accepts. The provider sees the booking address. Our admin team can see accounts and bookings to keep the service safe.",
  ],
  ["We never sell your details", "We do not sell or rent your details to anyone."],
  [
    "Saved addresses",
    "Addresses you book for are saved in your account for next time. You can remove them anytime from Saved addresses.",
  ],
  ["Emails", "We only email you about your account and your bookings."],
  [
    "Your choices",
    "You can change your name and mobile number in Account settings, and remove saved addresses anytime.",
  ],
];

function LegalPage({ title, sections }) {
  const { t, formatDate } = useLang();
  return (
    <div className="container-page max-w-3xl pt-10 sm:pt-14">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t(title)}</h1>
      <p className="mt-2 text-sm text-muted">{t("Last updated: {date}", { date: formatDate(UPDATED) })}</p>
      <div className="mt-8 grid gap-7">
        {sections.map(([heading, text]) => (
          <section key={heading}>
            <h2 className="text-xl font-semibold">{t(heading)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/85">{t(text)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Terms() {
  return <LegalPage title="Terms of use" sections={TERMS} />;
}

export function Privacy() {
  return <LegalPage title="Privacy policy" sections={PRIVACY} />;
}
