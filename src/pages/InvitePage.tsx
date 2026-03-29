import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLogo } from "@/components/layout/GeoLogo";
import { getToken } from "@/lib/api";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

interface InviteInfo {
  company_name: string;
  project_name: string;
  role: string;
  expires_at: string;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const token = getToken();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    checkInvite();
  }, [code]);

  async function checkInvite() {
    if (!code) {
      setError("Код приглашения не указан");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/invites/check/${code}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        if (res.status === 404) {
          setError("Приглашение не найдено");
        } else if (res.status === 410) {
          setError(body?.error || "Приглашение истекло или уже использовано");
        } else {
          setError(body?.error || "Ошибка проверки приглашения");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setInvite(data);
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!code) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/invites/accept/${code}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Ошибка принятия приглашения");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setProjectId(data.project_id || null);
      setSuccess(true);
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    if (password !== passwordConfirm) {
      setError("Пароли не совпадают");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/invites/register-and-accept/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim() || undefined,
          password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Ошибка регистрации");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      setProjectId(data.project_id || null);
      setSuccess(true);
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setSubmitting(false);
    }
  }

  function goToProject() {
    if (projectId) {
      navigate(`/projects/${projectId}`);
    } else {
      navigate("/projects");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ds-surface-sunken)] px-4">
        <div className="text-center">
          <div className="ds-spinner mx-auto mb-3" />
          <p className="text-sm" style={{ color: "var(--ds-text-muted)" }}>Проверка приглашения...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ds-surface-sunken)] px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <AppLogo size={48} />
          </div>
          <div className="ds-glass p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: "var(--ds-accent)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--ds-text)" }}>
              Приглашение принято
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--ds-text-muted)" }}>
              Вы успешно присоединились к проекту
            </p>
            <button onClick={goToProject} className="ds-btn w-full">
              Перейти к проекту
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ds-surface-sunken)] px-4">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <AppLogo size={48} />
          </div>
          <div className="ds-glass p-8 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: "var(--ds-text-faint)" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--ds-text)" }}>
              {error || "Приглашение недействительно"}
            </h2>
            <button
              onClick={() => navigate("/auth")}
              className="ds-btn-secondary mt-4"
            >
              На страницу входа
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ds-surface-sunken)] px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <AppLogo size={48} />
        </div>

        <div className="ds-glass p-8">
          <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: "var(--ds-text)" }}>
            Приглашение в проект
          </h2>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--ds-text-muted)" }}>Компания</span>
              <span className="font-medium" style={{ color: "var(--ds-text)" }}>{invite.company_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--ds-text-muted)" }}>Проект</span>
              <span className="font-medium" style={{ color: "var(--ds-text)" }}>{invite.project_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--ds-text-muted)" }}>Роль</span>
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface))", color: "var(--ds-accent)" }}
              >
                {invite.role}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}

          {token ? (
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="ds-btn w-full"
            >
              {submitting ? "Принятие..." : "Принять приглашение"}
            </button>
          ) : (
            <form onSubmit={handleRegisterAndAccept} className="space-y-4">
              <p className="text-sm text-center" style={{ color: "var(--ds-text-muted)" }}>
                Для принятия приглашения заполните данные для регистрации
              </p>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                  Фамилия *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="ds-input w-full"
                  placeholder="Иванов"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                  Имя *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="ds-input w-full"
                  placeholder="Иван"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                  Отчество
                </label>
                <input
                  type="text"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="ds-input w-full"
                  placeholder="Иванович"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                  Пароль *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ds-input w-full"
                  placeholder="Минимум 6 символов"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ds-text-muted)" }}>
                  Повторите пароль *
                </label>
                <input
                  type="password"
                  required
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="ds-input w-full"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="ds-btn w-full"
              >
                {submitting ? "Регистрация..." : "Зарегистрироваться и принять"}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate("/auth")}
              className="text-xs font-medium"
              style={{ color: "var(--ds-accent)" }}
            >
              {token ? "Вернуться" : "Уже есть аккаунт? Войти"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
