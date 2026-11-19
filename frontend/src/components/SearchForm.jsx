import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SlotPicker from "./SlotPicker.jsx";
import { FieldError } from "./ui.jsx";
import { firstOpenSlot, lastBookableDay, nowInIndia, slotClosed } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";

// Service + pincode + date + slot. Sends the customer to /search.
// onEdit (results page) is called when a field changes, before Search is pressed.
// searching (results page) shows a spinner on the button while results load.
export default function SearchForm({ services, initial = {}, serviceId, onServiceChange, onEdit, searching, layout = "card" }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const open = firstOpenSlot();

  const [ownService, setOwnService] = useState(initial.serviceId || "");
  const [pincode, setPincode] = useState(initial.pincode || localStorage.getItem("pincode") || "");
  const [date, setDate] = useState(initial.date || open.date);
  const [slot, setSlot] = useState(initial.slot || open.slot);
  const [error, setError] = useState("");

  // The home page controls the service from outside (clicking a service card)
  const service = serviceId !== undefined ? serviceId : ownService;
  const setService = onServiceChange || setOwnService;

  const isBar = layout === "bar";

  function changeDate(newDate) {
    setDate(newDate);
    onEdit?.();
    if (slotClosed(newDate, slot)) {
      const next = ["MORNING", "AFTERNOON", "EVENING"].find((s) => !slotClosed(newDate, s));
      if (next) setSlot(next);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!service) return setError("Choose the service you need");
    if (!/^\d{6}$/.test(pincode)) return setError("Enter your 6 digit pincode");
    if (!date) return setError("Choose a date");
    if (slotClosed(date, slot)) return setError("That time starts too soon to book. Pick a later slot or date.");
    setError("");
    localStorage.setItem("pincode", pincode);
    const params = new URLSearchParams({ serviceId: service, pincode, date, slot });
    navigate(`/search?${params}`, { state: { searchedAt: Date.now() } });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={isBar ? "grid gap-4 lg:grid-cols-12 lg:items-end" : "grid gap-5"}
    >
      <div className={isBar ? "grid gap-4 sm:grid-cols-3 lg:col-span-6" : "grid gap-5 sm:grid-cols-2"}>
        <div className={isBar ? "" : "sm:col-span-2"}>
          <label htmlFor="service" className="label">
            {t("Service")}
          </label>
          <select id="service" className="input" value={service} onChange={(e) => {
              setService(e.target.value);
              onEdit?.();
            }}>
            <option value="">{t("Choose a service")}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.name)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pincode" className="label">
            {t("Pincode")}
          </label>
          <input
            id="pincode"
            className="input"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            placeholder="700034"
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, ""));
              onEdit?.();
            }}
          />
        </div>
        <div>
          <label htmlFor="date" className="label">
            {t("Date")}
          </label>
          <input
            id="date"
            type="date"
            className="input"
            min={nowInIndia().today}
            max={lastBookableDay()}
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
        </div>
      </div>

      <div className={isBar ? "lg:col-span-4" : ""}>
        <span className="label">{t("Time")}</span>
        <SlotPicker date={date} value={slot} onChange={(value) => {
            setSlot(value);
            onEdit?.();
          }}
          compact={isBar} />
      </div>

      <div className={isBar ? "lg:col-span-2" : ""}>
        <button type="submit" disabled={searching} className={`btn-primary w-full ${isBar ? "" : "py-3.5 text-base"}`}>
          {searching && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper/40 border-t-paper motion-reduce:animate-none" />
          )}
          {searching ? t("Searching") : isBar ? t("Search") : t("See who is available")}
        </button>
      </div>

      {error && (
        <div className={isBar ? "lg:col-span-12" : ""}>
          <FieldError>{error}</FieldError>
        </div>
      )}
    </form>
  );
}
