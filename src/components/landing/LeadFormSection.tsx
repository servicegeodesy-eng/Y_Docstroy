import { useState, useRef, useEffect } from "react";
import type { PlanKey } from "./PricingSection";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PLAN_LABELS: Record<PlanKey, string> = {
  start: "Старт",
  standard: "Стандарт",
  business: "Бизнес",
  corporation: "Корпорация",
};

interface Props {
  selectedPlan: PlanKey | null;
  onClose: () => void;
}

export default function LeadFormSection({ selectedPlan, onClose }: Props) {
  const [form, setForm] = useState({
    company_name: "",
    inn: "",
    contact_name: "",
    phone: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!selectedPlan) return null;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.company_name || !form.contact_name || !form.phone || !form.email) {
      setError("Заполните все обязательные поля");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: selectedPlan, ...form }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Ошибка отправки");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Ошибка отправки заявки");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ds-overlay" ref={overlayRef}>
      <div className="ds-overlay-bg" onClick={onClose} />
      <div className="ds-modal w-full max-w-md">
        <div className="ds-modal-header">
          <h3 className="ds-modal-title">
            Подключение — {PLAN_LABELS[selectedPlan]}
          </h3>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4">
          {success ? (
            <div className="text-center py-6">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ background: "var(--ds-accent-muted)", color: "var(--ds-accent)" }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-semibold mb-2" style={{ color: "var(--ds-text)" }}>
                Заявка отправлена
              </h4>
              <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
                Мы свяжемся с вами в ближайшее время.
                Логин и пароль будут отправлены на указанную почту.
              </p>
              <button onClick={onClose} className="ds-btn">Закрыть</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm mb-2" style={{ color: "var(--ds-text-muted)" }}>
                Заполните данные юридического лица
              </p>

              <Field label="Название компании *" value={form.company_name} onChange={set("company_name")} placeholder="ООО «Строй-Инвест»" />
              <Field label="ИНН" value={form.inn} onChange={set("inn")} placeholder="1234567890" />
              <Field label="Контактное лицо *" value={form.contact_name} onChange={set("contact_name")} placeholder="Иванов Иван Иванович" />
              <Field label="Телефон *" value={form.phone} onChange={set("phone")} placeholder="+7 (999) 123-45-67" type="tel" />

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--ds-text)" }}>
                  Email *
                </label>
                <input
                  type="email"
                  className="ds-input w-full"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="admin@company.ru"
                />
                <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
                  На этот адрес будут отправлены логин и пароль, а также все уведомления
                </p>
              </div>

              {error && (
                <p className="text-sm" style={{ color: "var(--ds-danger)" }}>{error}</p>
              )}

              <button type="submit" className="ds-btn w-full" disabled={submitting}>
                {submitting ? "Отправка..." : "Отправить заявку"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--ds-text)" }}>
        {label}
      </label>
      <input
        type={type}
        className="ds-input w-full"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}
