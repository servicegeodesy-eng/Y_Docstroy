import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { PlanKey } from "./PricingSection";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const PLAN_LABELS: Record<PlanKey, string> = {
  start: "Старт",
  standard: "Стандарт",
  business: "Бизнес",
  corporation: "Корпорация",
};

interface Props {
  open: boolean;
  planKey: PlanKey | null;
  onClose: () => void;
}

interface FormData {
  company_name: string;
  inn: string;
  contact_name: string;
  phone: string;
  email: string;
}

const EMPTY: FormData = { company_name: "", inn: "", contact_name: "", phone: "", email: "" };

export default function LeadFormModal({ open, planKey, onClose }: Props) {
  const [form, setForm] = useState<FormData>({ ...EMPTY });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  }

  function handleClose() {
    setForm({ ...EMPTY });
    setError("");
    setSuccess(false);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planKey) return;

    if (!form.company_name.trim() || !form.contact_name.trim() || !form.phone.trim() || !form.email.trim()) {
      setError("Заполните все обязательные поля");
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_key: planKey, ...form }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Ошибка отправки");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Ошибка отправки заявки");
    } finally {
      setSending(false);
    }
  }

  if (!planKey) return null;

  return (
    <Modal open={open} onClose={handleClose} title={`Подключение тарифа «${PLAN_LABELS[planKey]}»`}>
      {success ? (
        <div className="text-center py-6">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--ds-accent-muted)", color: "var(--ds-accent)" }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--ds-text)" }}>
            Заявка отправлена
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--ds-text-muted)" }}>
            Мы свяжемся с вами в ближайшее время. Логин и пароль будут отправлены на указанный email.
          </p>
          <button onClick={handleClose} className="ds-btn">Закрыть</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Название компании *" value={form.company_name} onChange={(v) => set("company_name", v)} />
          <Field label="ИНН" value={form.inn} onChange={(v) => set("inn", v)} />
          <Field label="Контактное лицо *" value={form.contact_name} onChange={(v) => set("contact_name", v)} />
          <Field label="Телефон *" value={form.phone} onChange={(v) => set("phone", v)} type="tel" />
          <div>
            <Field label="Email *" value={form.email} onChange={(v) => set("email", v)} type="email" />
            <p className="text-xs mt-1" style={{ color: "var(--ds-text-faint)" }}>
              На этот адрес будут отправлены логин и пароль, а также все уведомления
            </p>
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--ds-danger)" }}>{error}</p>
          )}

          <button type="submit" className="ds-btn w-full" disabled={sending}>
            {sending ? "Отправка..." : "Отправить заявку"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1 block" style={{ color: "var(--ds-text)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ds-input w-full"
      />
    </label>
  );
}
