import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { WHATSAPP, waLink } from "../config";
import { ArrowRight, Check } from "./Icons";

type Status = "idle" | "sending" | "ok" | "error";

const PLAN_OPTIONS = [
  { value: "nose", label: "Todavía no sé" },
  { value: "light", label: "Versión Light: mi web, linda y a medida" },
  { value: "standard", label: "Versión Standard: web + reserva de turnos" },
  { value: "pro", label: "Versión Pro: todo resuelto, todos los meses" },
];

export const PICK_PLAN_EVENT = "pick-plan";

export function ContactForm() {
  const uid = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMsg, setServerMsg] = useState("");
  const [plan, setPlan] = useState("nose");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onPick = (e: Event) => {
      const value = (e as CustomEvent<string>).detail;
      if (typeof value === "string") setPlan(value);
    };
    window.addEventListener(PICK_PLAN_EVENT, onPick);
    // Precarga la validación cuando el navegador queda libre (no pesa en la carga inicial).
    const idle = window.requestIdleCallback?.(() => void import("../../../server/src/contact-schema"));
    return () => {
      window.removeEventListener(PICK_PLAN_EVENT, onPick);
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]).filter(([, v]) => v !== ""),
    ) as Record<string, string>;
    const { contactSchema, fieldErrors } = await import("../../../server/src/contact-schema");
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      // zod corre el chequeo cruzado (WhatsApp o email) solo si lo demás es válido: lo mostramos igual de entrada.
      if (!raw.phone && !raw.email && !errs.phone) errs.phone = "Dejanos un WhatsApp o un email para responderte";
      setErrors(errs);
      const first = Object.keys(errs)[0];
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setStatus("sending");
    setServerMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raw),
      });
      const body = (await res.json().catch(() => ({}))) as { fields?: Record<string, string>; message?: string };
      if (res.ok) {
        setStatus("ok");
        formRef.current?.reset();
        setPlan("nose");
        return;
      }
      if (body.fields) setErrors(body.fields);
      setServerMsg(body.message ?? "No pudimos enviar la consulta. Revisá los datos e intentá de nuevo.");
      setStatus("error");
    } catch {
      setServerMsg("Parece que no hay conexión. Probá de nuevo en un rato.");
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="form form--done" role="status">
        <span className="form__done-icon">
          <Check width={26} height={26} />
        </span>
        <h3>¡Listo! Ya nos llegó.</h3>
        <p>Te escribimos en horario comercial para coordinar. Mientras, si querés, mandanos fotos o el link de tu Instagram.</p>
        <button type="button" className="btn btn--ghost" onClick={() => setStatus("idle")}>
          Enviar otra consulta
        </button>
      </div>
    );
  }

  const field = (name: string) => ({
    id: `${uid}-${name}`,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? `${uid}-${name}-err` : undefined,
  });
  const err = (name: string) =>
    errors[name] ? (
      <span className="form__err" id={`${uid}-${name}-err`}>
        {errors[name]}
      </span>
    ) : null;

  return (
    <form ref={formRef} className="form" onSubmit={onSubmit} noValidate>
      <div className="form__grid">
        <label className="form__field" htmlFor={`${uid}-name`}>
          <span>Tu nombre</span>
          <input {...field("name")} autoComplete="name" placeholder="Ej. Laura" maxLength={80} />
          {err("name")}
        </label>
        <label className="form__field" htmlFor={`${uid}-business`}>
          <span>Tu negocio</span>
          <input {...field("business")} autoComplete="organization" placeholder="Ej. Estudio Lumen" maxLength={120} />
          {err("business")}
        </label>
        <label className="form__field" htmlFor={`${uid}-rubro`}>
          <span>
            Rubro <em>(opcional)</em>
          </span>
          <input {...field("rubro")} placeholder="Peluquería, veterinaria, consultorio…" maxLength={60} />
          {err("rubro")}
        </label>
        <label className="form__field" htmlFor={`${uid}-barrio`}>
          <span>
            Barrio <em>(opcional)</em>
          </span>
          <input {...field("barrio")} placeholder="Ej. Villa Crespo" maxLength={60} />
          {err("barrio")}
        </label>
        <label className="form__field" htmlFor={`${uid}-phone`}>
          <span>WhatsApp</span>
          <input {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="11 2345 6789" maxLength={30} />
          {err("phone")}
        </label>
        <label className="form__field" htmlFor={`${uid}-email`}>
          <span>
            Email <em>(o WhatsApp)</em>
          </span>
          <input {...field("email")} type="email" inputMode="email" autoComplete="email" placeholder="vos@tunegocio.com" maxLength={120} />
          {err("email")}
        </label>
        <label className="form__field form__field--full" htmlFor={`${uid}-plan`}>
          <span>¿Qué te interesa?</span>
          <select {...field("plan")} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {PLAN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form__field form__field--full" htmlFor={`${uid}-message`}>
          <span>
            Contanos un poco <em>(opcional)</em>
          </span>
          <textarea {...field("message")} rows={3} placeholder="Cómo te piden turnos hoy, tu Instagram, lo que quieras." maxLength={1500} />
          {err("message")}
        </label>
        <label className="form__hp" aria-hidden>
          Sitio web
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {status === "error" && serverMsg ? (
        <p className="form__server" role="alert">
          {serverMsg}
        </p>
      ) : null}
      <div className="form__actions">
        <button type="submit" className="btn btn--primary btn--lg" disabled={status === "sending"}>
          {status === "sending" ? "Enviando…" : "Quiero ver mi demo"}
          <ArrowRight width={18} height={18} />
        </button>
        <p className="form__legal">
          Usamos tus datos solo para responderte. Si no querés que te escribamos más, avisanos y listo.
          {WHATSAPP ? (
            <>
              {" "}
              ¿Más rápido?{" "}
              <a href={waLink("Hola! Quiero ver cómo quedaría la web de mi negocio.")} target="_blank" rel="noopener">
                Escribinos por WhatsApp
              </a>
              .
            </>
          ) : null}
        </p>
      </div>
    </form>
  );
}
