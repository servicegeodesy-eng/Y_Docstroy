import { storage, api } from "./api";

const BUCKET = "cell-files";

/** Генерирует безопасный путь в storage */
function buildPath(prefix: string, file: File): string {
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  return `${prefix}/${crypto.randomUUID()}${ext}`;
}

/** Загрузить файл в Storage и вставить запись в cell_files. Возвращает storagePath. */
export async function uploadCellFile(
  projectId: string,
  cellId: string,
  file: File,
  userId: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("cellId", cellId);
  formData.append("projectId", projectId);

  const { data, error } = await api.upload<{ id: string; storage_path: string }>(
    "/api/files/cell",
    formData,
  );

  if (error || !data) throw new Error(error || "Upload failed");
  return data.storage_path;
}

/** Загрузить файл в Storage (без записи в cell_files). Для кастомных таблиц (gro, remarks и т.д.) */
export async function uploadRawFile(prefix: string, file: File): Promise<string> {
  const storagePath = buildPath(prefix, file);
  const { error } = await storage.from(BUCKET).upload(storagePath, file);
  if (error) throw new Error(error);
  return storagePath;
}

/** Удалить файлы из Storage */
export async function removeFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await storage.from(BUCKET).remove(paths);
}

/** Удалить файл из Storage + запись из cell_files */
export async function deleteCellFile(fileId: string, storagePath: string): Promise<void> {
  await api.delete(`/api/files/cell/${fileId}`);
}

/** Скачать файл из Storage */
export async function downloadFile(storagePath: string): Promise<Blob | null> {
  const { data } = await storage.from(BUCKET).download(storagePath);
  return data;
}
