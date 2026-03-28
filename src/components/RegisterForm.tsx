import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, api } from "@/lib/api";

export default function RegisterForm() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const displayName = (form.get("display_name") as string).trim();
    const password = form.get("password") as string;

    if (!displayName) {
      setError("Введите Фамилию и инициалы");
      setLoading(false);
      return;
    }

    // Проверяем, не сущес��вует ли уже такой пользователь
    const { data: existing } = await api.get<{ id: string }[]>("/api/users/search", { q: displayName });
    if (existing && existing.length > 0) {
      const exactMatch = existing.find(
        (u: { display_name?: string }) =>
          (u as { display_name?: string }).display_name?.toLowerCase() === displayName.toLowerCase()
      );
      if (exactMatch) {
        setError("Такой пользователь уже зарегистрирован");
        setLoading(false);
        return;
      }
    }

    const randomId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const generatedEmail = `user_${randomId}@portal.local`;

    const { error: signUpError } = await auth.signUp({
      email: generatedEmail,
      password,
      last_name: displayName,
      first_name: "",
      structure: "Подрядчик",
      organization: "",
      position: "Геодезист",
    });

    if (signUpError) {
      setError(signUpError);
      setLoading(false);
      return;
    }

    // Auto-login after signup
    const { error: loginError } = await auth.signInWithPassword({
      email: generatedEmail,
      password,
    });

    if (loginError) {
      // Registration succeeded but auto-login failed — redirect to login page
      navigate("/login");
      return;
    }

    navigate("/projects");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="ds-alert-error">{error}</div>
      )}

      <div>
        <label htmlFor="reg-display-name" className="ds-label">
          Фамилия и инициалы <span className="text-red-500">*</span>
        </label>
        <input
          id="reg-display-name"
          name="display_name"
          type="text"
          required
          className="ds-input"
          placeholder="Иванов И.И."
        />
      </div>

      <div>
        <label htmlFor="reg-password" className="ds-label">
          Пароль <span className="text-red-500">*</span>
        </label>
        <input
          id="reg-password"
          name="password"
          type="password"
          required
          minLength={6}
          className="ds-input"
          placeholder="Минимум 6 символов"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="ds-btn w-full"
      >
        {loading ? "Регистрация..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
