import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/api";

export default function LoginForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [adminResetMode, setAdminResetMode] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const [query, setQuery] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) {
      setError("Введите фамилию");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: loginError } = await auth.signInByName({
        query: query.trim(),
        password,
      });

      if (loginError) {
        // Distinguish network errors from auth errors
        if (loginError.includes("fetch") || loginError.includes("network") || loginError.includes("Failed")) {
          setError("Нет соединения с сервером. Проверьте интернет и попробуйте снова.");
        } else if (loginError.includes("несколько") || loginError.includes("уточните")) {
          setError("Найдено несколько пользователей с такой фамилией. Уточните ФИО.");
        } else if (loginError.includes("не найден")) {
          setError("Пользователь не найден");
        } else {
          setError("Неверный пароль");
        }
        setLoading(false);
        return;
      }

      navigate("/projects");
    } catch {
      setError("Нет соединения с сервером. Проверьте интернет и попробуйте снова.");
      setLoading(false);
    }
  }

  async function handleAdminReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = resetEmail.trim();
    if (!email) {
      setError("Введите ваш email");
      return;
    }
    setResetLoading(true);
    setError(null);

    try {
      await auth.resetPasswordForEmail(email);
      // Всегда показываем успех, чтобы не раскрывать существование email
      setResetSuccess(true);
    } catch {
      setError("Ошибка соединения с сервером");
    }
    setResetLoading(false);
  }

  if (resetMode) {
    // Шаг 3: Успех отправки
    if (resetSuccess) {
      return (
        <div className="space-y-4">
          <div className="ds-alert-success">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Письмо отправлено</p>
                <p className="mt-1 opacity-90">
                  Если указанный email зарегистрирован в системе, на него будет отправлена ссылка для сброса пароля.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setResetMode(false);
              setAdminResetMode(false);
              setResetSuccess(false);
              setError(null);
              setResetEmail("");
            }}
            className="ds-btn w-full"
          >
            Вернуться ко входу
          </button>
        </div>
      );
    }

    // Шаг 2: Форма ввода email администратора
    if (adminResetMode) {
      return (
        <div className="space-y-4">
          <div className="ds-alert-info">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Подтверждение администратора</p>
                <p className="mt-1 opacity-90">
                  Введите ваш email, привязанный к учётной записи администратора.
                  На него будет отправлена ссылка для сброса пароля.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="ds-alert-error">{error}</div>
          )}

          <form onSubmit={handleAdminReset} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="ds-label">
                Email администратора
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={resetEmail}
                onChange={(e) => { setResetEmail(e.target.value); setError(null); }}
                className="ds-input"
                placeholder="Введите ваш email..."
              />
            </div>

            <button
              type="submit"
              disabled={resetLoading || resetEmail.trim().length === 0}
              className="ds-btn w-full"
            >
              {resetLoading ? "Отправка..." : "Отправить ссылку для сброса"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setAdminResetMode(false); setError(null); setResetEmail(""); }}
            className="w-full py-2 text-sm transition-colors"
            style={{ color: "var(--ds-text-muted)" }}
          >
            Назад
          </button>
        </div>
      );
    }

    // Шаг 1: Обратитесь к администратору + кнопка «Я адм��нистратор»
    return (
      <div className="space-y-4">
        <div className="ds-alert-info">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium">Восстановление пароля</p>
              <p className="mt-1 opacity-90">
                Для восстановления пароля обратитесь к администратору портала.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { setAdminResetMode(true); setError(null); }}
          className="ds-btn w-full"
        >
          Я администратор
        </button>

        <button
          type="button"
          onClick={() => { setResetMode(false); setError(null); }}
          className="w-full py-2 text-sm transition-colors"
          style={{ color: "var(--ds-text-muted)" }}
        >
          Вернуться ко входу
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="ds-alert-error">{error}</div>
      )}

      <div>
        <label htmlFor="login-name" className="ds-label">
          Фамилия
        </label>
        <input
          id="login-name"
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          className="ds-input"
          placeholder="Введите фамилию..."
        />
      </div>

      <div>
        <label htmlFor="login-password" className="ds-label">
          Пароль
        </label>
        <input
          id="login-password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="ds-input"
          placeholder="Введите пароль"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setResetMode(true); setError(null); }}
          className="text-sm transition-colors"
          style={{ color: "var(--ds-text-muted)" }}
        >
          Забыли пароль?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading || query.trim().length === 0}
        className="ds-btn w-full"
      >
        {loading ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
