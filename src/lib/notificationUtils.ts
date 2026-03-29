import { api } from "./api";

/**
 * Помечает все уведомления по ячейке как прочитанные.
 * Вызывается из модалов после выполнения действия (подпись, замечания и т.д.)
 * Триггер auto_read_notifications в БД делает то же самое как страховка.
 */
export async function markCellNotificationsRead(cellId: string): Promise<void> {
  try {
    await api.patch(`/api/notifications/read-by-cell/${cellId}`, {});
  } catch {
    // Не критично — триггер в БД подстрахует
  }
}
