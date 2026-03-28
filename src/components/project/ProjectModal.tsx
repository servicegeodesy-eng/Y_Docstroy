import { FormEvent, useState } from "react";
import Modal from "@/components/ui/Modal";

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
  initial?: { name: string; description: string };
}

export default function ProjectModal({ open, onClose, onSave, initial }: ProjectModalProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSave(name.trim(), description.trim());
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
