import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { shortName } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: Props) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: profile } = await api.get<{
        last_name: string;
        first_name: string;
        middle_name: string | null;
      }>("/api/auth/me");

      if (profile) {
        setDisplayName(shortName(profile));
      }

      setLoading(false);
    }

    load();
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Введите Фамилию и инициалы");
      setSaving(false);
      return;
    }

    const { error: err } = await api.patch(`/api/users/${user.id}`, {
      last_name: trimmed,
      first_name: "",
      middle_name: null,
    });

    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Пароли не совпадают");
      return;
    }

    setPasswordSaving(true);

    const { error } = await api.post("/api/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });

    setPasswordSaving(false);
    if (error) {
      setPasswordError(error);
    } else {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 2000);
    }
  }

  return (
    <div className="ds-overlay p-4" onClick={onClose}>
      <div className="ds-overlay-bg" />
      <div
        className="ds-modal w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Личный кабинет</h2>
          <button onClick={onClose} className="ds-icon-btn">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center" style={{ color: "var(--ds-text-faint)" }}>Загрузка профиля...</div>
        ) : (
          <div className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--ds-text-muted)" }}>Данные профиля</h3>

              {error && (
                <div className="ds-alert-error">{error}</div>
              )}
              {success && (
                <div className="ds-alert-success">Данные сохранены</div>
              )}

              <div>
                <label className="ds-label">
                  Фамилия и инициалы <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="ds-input"
                  placeholder="Иванов И.И."
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="ds-btn">
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>

            <div className="ds-divider" />

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--ds-text-muted)" }}>Изменить пароль</h3>

              {passwordError && (
                <div className="ds-alert-error">{passwordError}</div>
              )}
              {passwordSuccess && (
                <div className="ds-alert-success">Пароль изменён</div>
              )}

              <div>
                <label className="ds-label">Текущий пароль</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="ds-input"
                  placeholder="Введите текущий пароль"
                />
              </div>

              <div>
                <label className="ds-label">Новый пароль</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ds-input"
                  placeholder="Минимум 6 символов"
                />
              </div>

              <div>
                <label className="ds-label">Подтвердите пароль</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="ds-input"
                  placeholder="Повторите пароль"
                />
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={passwordSaving} className="ds-btn">
                  {passwordSaving ? "Сохранение..." : "Изменить пароль"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
