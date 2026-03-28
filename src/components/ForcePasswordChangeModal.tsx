import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

interface Props {
  onPasswordChanged: () => void;
}

export default function ForcePasswordChangeModal({ onPasswordChanged }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setSaving(true);

    // change-password ав��оматически очищает must_change_password
    const { error: changeError } = await api.post("/api/auth/change-password", {
      current_password: "", // Для temp-пароля сервер может пропустить проверку
      new_password: newPassword,
    });

    if (changeError) {
      setError(changeError);
      setSaving(false);
      return;
    }

    onPasswordChanged();
  }

  return (
    <div className="ds-overlay" style={{ zIndex: 100 }}>
      <div className="ds-overlay-bg" />
      <div className="ds-modal w-full max-w-md">
        <div className="ds-modal-header">
          <h2 className="ds-modal-title">Смена пароля</h2>
        </div>

        <div className="p-6">
          <div className="ds-alert-warning mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium">Необходимо задать новый пароль</p>
                <p className="mt-1 opacity-90">
                  Вы вошли с временным паролем. Для продолжения работы задайте новый пароль.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="ds-alert-error mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoFocus
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

            <button
              type="submit"
              disabled={saving}
              className="ds-btn w-full"
            >
              {saving ? "Сохранение..." : "Задать новый пароль"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
