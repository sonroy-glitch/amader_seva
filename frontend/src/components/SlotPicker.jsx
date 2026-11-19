import { SLOTS, slotClosed, slotStarted } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";

// Three buttons: Morning / Afternoon / Evening. Slots starting within 2 hours today are disabled.
export default function SlotPicker({ date, value, onChange, allowed, compact = false }) {
  const { t } = useLang();
  return (
    <div role="radiogroup" aria-label={t("Time slot")} className="grid grid-cols-3 gap-2">
      {SLOTS.map((slot) => {
        const started = slotStarted(date, slot.value);
        const closed = slotClosed(date, slot.value);
        const notOffered = allowed && !allowed.includes(slot.value);
        const disabled = closed || notOffered;
        const selected = value === slot.value;
        return (
          <button
            key={slot.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(slot.value)}
            className={`rounded-lg border px-2 text-left transition-colors ${compact ? "py-2" : "py-2.5"} ${
              selected
                ? "border-green bg-green text-paper"
                : "border-line bg-card text-ink hover:border-ink/30"
            } disabled:cursor-not-allowed disabled:border-line disabled:bg-sand/60 disabled:text-muted/60`}
          >
            <span className="block text-sm font-semibold sm:px-1">{t(slot.label)}</span>
            <span className={`block text-xs sm:px-1 ${selected ? "text-paper/80" : "text-muted"}`}>
              {started ? t("Started") : closed ? t("Too soon") : notOffered ? t("Not offered") : t(slot.time)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
