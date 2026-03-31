const PLANS = [
  {
    key: "trial",
    name: "Пробный",
    price: "0",
    trialDays: 30,
    objects: 1,
    users: 10,
    storage: "10 ГБ",
    popular: false,
  },
  {
    key: "start",
    name: "Старт",
    price: "35 000",
    objects: 1,
    users: 30,
    storage: "50 ГБ",
    popular: false,
  },
  {
    key: "standard",
    name: "Стандарт",
    price: "150 000",
    objects: 5,
    users: 150,
    storage: "500 ГБ",
    popular: true,
  },
  {
    key: "business",
    name: "Бизнес",
    price: "250 000",
    objects: 10,
    users: 400,
    storage: "1 ТБ",
    popular: false,
  },
  {
    key: "corporation",
    name: "Корпорация",
    price: "400 000",
    objects: 20,
    users: 1000,
    storage: "5 ТБ",
    popular: false,
  },
] as const;

export type PlanKey = (typeof PLANS)[number]["key"];

interface Props {
  onSelectPlan: (planKey: PlanKey) => void;
}

export default function PricingSection({ onSelectPlan }: Props) {
  return (
    <section id="pricing" className="py-12 sm:py-16" style={{ background: "var(--ds-surface-sunken)" }}>
      <div className="max-w-6xl mx-auto px-4">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-3"
          style={{ color: "var(--ds-text)" }}
        >
          Тарифы
        </h2>
        <p className="text-center mb-10 text-sm" style={{ color: "var(--ds-text-muted)" }}>
          Выберите подходящий тариф для вашей компании
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {PLANS.map((plan) => (
            <PlanCard key={plan.key} plan={plan} onSelect={() => onSelectPlan(plan.key)} />
          ))}
        </div>

        {/* Гибкие опции */}
        <div
          className="mt-8 rounded-xl p-5 text-center"
          style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)" }}
        >
          <h3 className="font-semibold mb-3" style={{ color: "var(--ds-text)" }}>
            Гибкие опции
          </h3>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8 text-sm" style={{ color: "var(--ds-text-muted)" }}>
            <span>+10 пользователей на объект — <b style={{ color: "var(--ds-text)" }}>10 000 руб/мес</b></span>
            <span>+1 объект — <b style={{ color: "var(--ds-text)" }}>40 000 руб/мес</b></span>
            <span>+50 ГБ хранилища — <b style={{ color: "var(--ds-text)" }}>10 000 руб/мес</b></span>
          </div>
        </div>

        {/* Общие условия */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ConditionItem text="Настройка проекта по рабочей документации за 7 рабочих дней" />
          <ConditionItem text="Приглашение пользователей администратором компании" />
          <ConditionItem text="При остановке подписки — просмотр и скачивание 6 месяцев" />
          <ConditionItem text="Через 6 месяцев без подписки данные удаляются" />
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  onSelect,
}: {
  plan: (typeof PLANS)[number];
  onSelect: () => void;
}) {
  return (
    <div
      className="ds-card p-5 flex flex-col relative"
      style={
        plan.popular
          ? { border: "2px solid var(--ds-accent)" }
          : undefined
      }
    >
      {plan.popular && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-0.5 rounded-full"
          style={{ background: "var(--ds-accent)", color: "#fff" }}
        >
          Популярный
        </span>
      )}
      <h3 className="text-lg font-bold mb-1" style={{ color: "var(--ds-text)" }}>
        {plan.name}
      </h3>
      <div className="mb-4">
        {plan.price === "0" ? (
          <>
            <span className="text-2xl font-bold" style={{ color: "var(--ds-accent)" }}>Бесплатно</span>
            {"trialDays" in plan && (
              <span className="text-sm ml-1" style={{ color: "var(--ds-text-muted)" }}>/ {plan.trialDays} дней</span>
            )}
          </>
        ) : (
          <>
            <span className="text-2xl font-bold" style={{ color: "var(--ds-accent)" }}>
              {plan.price}
            </span>
            <span className="text-sm ml-1" style={{ color: "var(--ds-text-muted)" }}>руб/мес</span>
          </>
        )}
      </div>

      <ul className="flex-1 space-y-2 mb-5 text-sm" style={{ color: "var(--ds-text-muted)" }}>
        <li className="flex items-start gap-2">
          <CheckIcon />
          <span>До <b style={{ color: "var(--ds-text)" }}>{plan.objects}</b> {pluralObjects(plan.objects)}</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckIcon />
          <span>До <b style={{ color: "var(--ds-text)" }}>{plan.users}</b> пользователей</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckIcon />
          <span>Хранилище <b style={{ color: "var(--ds-text)" }}>{plan.storage}</b></span>
        </li>
      </ul>

      <button
        onClick={onSelect}
        className={plan.popular ? "ds-btn w-full" : "ds-btn-secondary w-full"}
      >
        Подключить
      </button>
    </div>
  );
}

function ConditionItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ds-text-muted)" }}>
      <CheckIcon />
      <span>{text}</span>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 mt-0.5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      style={{ color: "var(--ds-accent)" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function pluralObjects(n: number): string {
  if (n === 1) return "объект";
  if (n >= 2 && n <= 4) return "объекта";
  return "объектов";
}
