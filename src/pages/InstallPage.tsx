import { useEffect, useState } from "react";
import { AppLogo } from "@/components/layout/GeoLogo";
import { isGeoMode } from "@/lib/geoMode";
import { usePwaInstall } from "@/lib/usePwaInstall";

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);
}

export default function InstallPage() {
  const [platform] = useState(detectPlatform);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const { canInstall, install } = usePwaInstall();
  const geo = isGeoMode();
  const appName = geo ? "Служба геодезии" : "DocStroy";
  const installLabel = geo ? "приложение Служба геодезии" : "DocStroy";

  useEffect(() => {
    setAlreadyInstalled(isStandalone());
  }, []);

  if (alreadyInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--ds-surface-sunken)" }}>
        <div className="max-w-md w-full text-center space-y-4">
          <AppLogo size={36} />
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "#22c55e" }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--ds-text)" }}>Приложение уже установлено</h1>
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
            {appName} уже работает на вашем устройстве.
          </p>
          <a href="/auth" className="ds-btn inline-block px-6 py-2 text-sm font-medium">Открыть {appName}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--ds-surface-sunken)" }}>
      <div className="max-w-lg w-full space-y-6">
        {/* Шапка */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <AppLogo size={36} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ds-text)" }}>
            Установить {installLabel}
          </h1>
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>
            Приложение работает без App Store и Google Play.
            Установка занимает несколько секунд.
          </p>
        </div>

        {/* Быстрая установка (если браузер поддерживает) */}
        {canInstall && (
          <div className="ds-card p-6 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: "var(--ds-accent)" }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
              </svg>
            </div>
            <button
              onClick={install}
              className="ds-btn px-8 py-3 text-base font-semibold w-full"
            >
              Установить {installLabel}
            </button>
            <p className="text-xs" style={{ color: "var(--ds-text-faint)" }}>
              Нажмите кнопку — приложение появится на рабочем столе
            </p>
          </div>
        )}

        {/* Инструкция для платформы */}
        <div className="ds-card p-6 space-y-4">
          <h2 className="font-semibold" style={{ color: "var(--ds-text)" }}>
            {canInstall ? "Или установите вручную:" : "Как установить:"}
          </h2>

          {platform === "ios" && <IosSteps />}
          {platform === "android" && <AndroidSteps canInstall={canInstall} />}
          {platform === "desktop" && <DesktopSteps canInstall={canInstall} />}
        </div>

        {/* Преимущества */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "Быстрый запуск" },
            { icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", label: "Push-уведомления" },
            { icon: "M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z", label: "Как приложение" },
          ].map((f) => (
            <div key={f.label} className="text-center p-3 rounded-xl" style={{ background: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border)" }}>
              <svg className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--ds-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
              </svg>
              <p className="text-xs font-medium" style={{ color: "var(--ds-text-muted)" }}>{f.label}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs" style={{ color: "var(--ds-text-faint)" }}>
          Приложение не занимает память — это ярлык на сайт с возможностями приложения.
        </p>
      </div>
    </div>
  );
}

/* ────── Пошаговые инструкции по платформам ────── */

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: "var(--ds-accent)", color: "#fff" }}
      >{n}</span>
      <div className="text-sm pt-0.5" style={{ color: "var(--ds-text-muted)" }}>{children}</div>
    </div>
  );
}

function IosSteps() {
  return (
    <div className="space-y-4">
      <div className="px-3 py-2 rounded-lg text-xs font-medium text-center" style={{ background: "color-mix(in srgb, #f59e0b 10%, var(--ds-surface))", color: "#f59e0b", border: "1px solid color-mix(in srgb, #f59e0b 30%, var(--ds-border))" }}>
        Откройте эту страницу в Safari (в других браузерах на iOS установка недоступна)
      </div>
      <Step n={1}>
        <p>Нажмите кнопку <strong>«Поделиться»</strong> внизу экрана (квадрат со стрелкой вверх).</p>
      </Step>
      <Step n={2}>
        <p>Прокрутите вниз и выберите <strong>«На экран Домой»</strong>.</p>
      </Step>
      <Step n={3}>
        <p>Нажмите <strong>«Добавить»</strong> — иконка появится на рабочем столе.</p>
      </Step>
    </div>
  );
}

function AndroidSteps({ canInstall }: { canInstall: boolean }) {
  if (canInstall) {
    return (
      <div className="space-y-4">
        <Step n={1}>
          <p>Нажмите кнопку <strong>«Установить»</strong> выше — приложение установится автоматически.</p>
        </Step>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Step n={1}>
        <p>Откройте <strong>меню браузера</strong> (три точки в правом верхнем углу).</p>
      </Step>
      <Step n={2}>
        <p>Выберите <strong>«Установить приложение»</strong> или <strong>«Добавить на главный экран»</strong>.</p>
      </Step>
      <Step n={3}>
        <p>Подтвердите — иконка появится на рабочем столе.</p>
      </Step>
    </div>
  );
}

function DesktopSteps({ canInstall }: { canInstall: boolean }) {
  if (canInstall) {
    return (
      <div className="space-y-4">
        <Step n={1}>
          <p>Нажмите кнопку <strong>«Установить»</strong> выше, или значок установки в адресной строке браузера.</p>
        </Step>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Step n={1}>
        <p>В <strong>адресной строке</strong> браузера найдите значок установки (обычно справа — иконка монитора с плюсом или стрелкой).</p>
      </Step>
      <Step n={2}>
        <p>Нажмите на него и выберите <strong>«Установить»</strong>.</p>
      </Step>
      <Step n={3}>
        <p>Приложение откроется в отдельном окне и появится в меню «Пуск» / Launchpad.</p>
      </Step>
    </div>
  );
}
