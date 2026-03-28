import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Удалить",
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm mb-6" style={{ color: "var(--ds-text-muted)" }}>{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="ds-btn-secondary">
          Отмена
        </button>
        <button onClick={onConfirm} disabled={loading} className="ds-btn-danger">
          {loading ? "Удаление..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}
