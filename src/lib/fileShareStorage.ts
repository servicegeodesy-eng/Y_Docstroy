import { storage, api } from "./api";

const BUCKET = "fileshare-files";

export const MAX_FILES = 10;
export const MAX_TOTAL_SIZE = 30 * 1024 * 1024; // 30 MB

function buildPath(projectId: string, shareId: string, file: File): string {
  const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
  return `${projectId}/${shareId}/${crypto.randomUUID()}${ext}`;
}

export async function uploadShareFile(
  projectId: string,
  shareId: string,
  file: File,
): Promise<string> {
  const storagePath = buildPath(projectId, shareId, file);

  const { error: uploadErr } = await storage.from(BUCKET).upload(storagePath, file);
  if (uploadErr) throw new Error(uploadErr);

  // Insert record into file_share_files via API
  const { error: insertErr } = await api.post("/api/fileshare/file", {
    share_id: shareId,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || "application/octet-stream",
    storage_path: storagePath,
  });

  if (insertErr) {
    await storage.from(BUCKET).remove([storagePath]);
    throw new Error(insertErr);
  }

  return storagePath;
}

export async function removeShareFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await storage.from(BUCKET).remove(paths);
}

export async function downloadShareFile(storagePath: string): Promise<Blob | null> {
  const { data } = await storage.from(BUCKET).download(storagePath);
  return data;
}
