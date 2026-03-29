import { FormEvent, useState } from "react";
import Modal from "@/components/ui/Modal";

interface Company {
  id: string;
  name: string;
}

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, companyId?: string) => Promise<void>;
  initial?: { name: string; description: string };
  companies?: Company[];
}

export default function ProjectModal({ open, onClose, onSave, initial, companies }: ProjectModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [companyId, setCompanyId] = useState(companies?.[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!initial && companies?.length && !companyId) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim(), initial ? undefined : companyId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Редактировать проект" : "Новый проект"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="ds-alert-error">{error}</div>}
        {!initial && companies && companies.length > 1 && (
          <div>
            <label className="ds-label">Компания</label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="ds-input"
              required
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="ds-label">Название</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="ds-input"
            placeholder="Название проекта"
          />
        </div>
        <div>
          <label className="ds-label">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="ds-input resize-none"
            placeholder="Описание проекта (необязательно)"
          />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="ds-btn-secondary">
            Отмена
          </button>
          <button type="submit" disabled={loading || !name.trim()} className="ds-btn">
            {loading ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
