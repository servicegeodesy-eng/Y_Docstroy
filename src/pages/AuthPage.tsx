import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import RegisterForm from "@/components/RegisterForm";
import { AppLogo } from "@/components/layout/GeoLogo";
import { useTheme } from "@/lib/ThemeContext";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ds-surface-sunken)] px-4 transition-colors">
      {/* Переключатель темы */}
      <div className="fixed top-4 right-4">
        <button
          onClick={toggleTheme}
          className="ds-icon-btn"
          title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
        >
          {theme === "dark" ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AppLogo size={48} />
        </div>

        <div className="ds-glass p-8">
          {/* Tab switcher - pill style */}
          <div className="flex mb-6 rounded-xl p-1" style={{ background: "var(--ds-surface-sunken)" }}>
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isLogin
                  ? "text-white shadow-md"
                  : "hover:opacity-80"
              }`}
              style={
                isLogin
                  ? { background: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))" }
                  : { color: "var(--ds-text-muted)" }
              }
            >
              Вход
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                !isLogin
                  ? "text-white shadow-md"
                  : "hover:opacity-80"
              }`}
              style={
                !isLogin
                  ? { background: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))" }
                  : { color: "var(--ds-text-muted)" }
              }
            >
              Регистрация
            </button>
          </div>

          {isLogin ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
}
