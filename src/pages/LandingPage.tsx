import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { AppLogo } from "@/components/layout/GeoLogo";
import PricingSection, { type PlanKey } from "@/components/landing/PricingSection";
import LeadFormModal from "@/components/landing/LeadFormModal";

export default function LandingPage() {
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--ds-surface-sunken)" }}>
      {/* Header */}
      <header className="px-4 py-4 sm:py-5" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size={36} />
            <span className="text-lg font-bold" style={{ color: "var(--ds-text)" }}>DocStroy</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to="/projects" className="ds-btn text-sm">
                Мои проекты
              </Link>
            ) : (
              <>
                <Link to="/auth" className="ds-btn-secondary text-sm">
                  Войти
                </Link>
                <Link to="/auth?tab=register" className="ds-btn text-sm">
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20 w-full">
          <div className="max-w-3xl">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-6"
              style={{ color: "var(--ds-text)" }}
            >
              Цифровой документооборот
              <br />
              <span style={{ color: "var(--ds-accent)" }}>строительных проектов</span>
            </h1>
            <p
              className="text-base sm:text-lg mb-8 max-w-2xl leading-relaxed"
              style={{ color: "var(--ds-text-muted)" }}
            >
              DocStroy — платформа для управления строительной документацией.
              Контроль качества работ, согласование документов, отслеживание статусов
              и совместная работа заказчиков, подрядчиков и проверяющих в одном месте.
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link to="/projects" className="ds-btn px-6 py-2.5 text-base">
                  Перейти к проектам
                </Link>
              ) : (
                <>
                  <Link to="/auth?tab=register" className="ds-btn px-6 py-2.5 text-base">
                    Начать работу
                  </Link>
                  <Link to="/auth" className="ds-btn-secondary px-6 py-2.5 text-base">
                    Войти в аккаунт
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 sm:py-16" style={{ background: "var(--ds-surface)" }}>
        <div className="max-w-6xl mx-auto px-4">
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-10"
            style={{ color: "var(--ds-text)" }}
          >
            Возможности платформы
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Реестр документов"
              description="Систематизированный учёт актов, протоколов и исполнительной документации с привязкой к зданиям, этажам и видам работ."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <FeatureCard
              title="Согласование и подписание"
              description="Электронный документооборот с цепочками согласования, замечаниями и статусами утверждения."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            />
            <FeatureCard
              title="Планы и оверлеи"
              description="Привязка документов к планам этажей и фасадам с интерактивными масками и осевыми сетками."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
            />
            <FeatureCard
              title="Мульти-компании"
              description="Заказчики, подрядчики и генподрядчики работают в одном проекте с разграничением прав доступа."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <FeatureCard
              title="Рассылка файлов"
              description="Массовая отправка документов участникам проекта с отслеживанием получения и прочтения."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />
            <FeatureCard
              title="Авторский надзор"
              description="Фиксация результатов авторского надзора и строительного контроля с фотоматериалами."
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection onSelectPlan={setSelectedPlan} />

      {/* CTA */}
      <section className="py-12 sm:py-16" style={{ background: "var(--ds-surface)" }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: "var(--ds-text)" }}>
            Готовы начать?
          </h2>
          <p className="text-sm sm:text-base mb-6" style={{ color: "var(--ds-text-muted)" }}>
            Оставьте заявку — мы настроим проект по вашей рабочей документации
            за 7 рабочих дней и передадим администратору компании.
          </p>
          <button onClick={() => setSelectedPlan("start")} className="ds-btn px-8 py-2.5 text-base">
            Оставить заявку
          </button>
        </div>
      </section>

      {/* Lead form modal */}
      <LeadFormModal
        open={selectedPlan !== null}
        planKey={selectedPlan}
        onClose={() => setSelectedPlan(null)}
      />

      {/* Footer */}
      <footer className="py-6 px-4 text-center" style={{ borderTop: "1px solid var(--ds-border)" }}>
        <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
          DocStroy &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="ds-card p-5">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
        style={{ background: "var(--ds-accent-muted)", color: "var(--ds-accent)" }}
      >
        {icon}
      </div>
      <h3 className="font-semibold mb-2" style={{ color: "var(--ds-text)" }}>
        {title}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ds-text-muted)" }}>
        {description}
      </p>
    </div>
  );
}
