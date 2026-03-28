export interface ProfileShort {
  last_name: string;
  first_name: string;
  middle_name: string | null;
}

export function shortName(p: ProfileShort | null): string {
  if (!p) return "";
  const fi = p.first_name ? " " + p.first_name[0] + "." : "";
  const mi = p.middle_name ? p.middle_name[0] + "." : "";
  return p.last_name + fi + mi;
}

export function fullName(p: ProfileShort): string {
  return shortName(p);
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " Б";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
  return (bytes / (1024 * 1024)).toFixed(1) + " МБ";
}

export function getExt(name: string): string {
  return name.split(".").pop()?.toUpperCase() || "";
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function downloadStorage(storagePath: string, fileName: string): Promise<void> {
  const { downloadFile } = await import("@/lib/fileStorage");
  const data = await downloadFile(storagePath);
  if (data) {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}

/** Скачать несколько файлов одним ZIP-архивом.
 *  bucket: "cell-files" (по умолчанию) или "fileshare-files" */
export async function downloadAsZip(
  files: { storagePath: string; fileName: string }[],
  archiveName: string,
  bucket: "cell-files" | "fileshare-files" = "cell-files",
): Promise<void> {
  if (files.length === 0) return;
  if (files.length === 1) {
    if (bucket === "fileshare-files") {
      const { downloadShareFile } = await import("@/lib/fileShareStorage");
      const blob = await downloadShareFile(files[0].storagePath);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = files[0].fileName; a.click();
        URL.revokeObjectURL(url);
      }
    } else {
      await downloadStorage(files[0].storagePath, files[0].fileName);
    }
    return;
  }
  const { default: JSZip } = await import("jszip");
  const downloadFn = bucket === "fileshare-files"
    ? (await import("@/lib/fileShareStorage")).downloadShareFile
    : (await import("@/lib/fileStorage")).downloadFile;
  const zip = new JSZip();
  const usedNames = new Map<string, number>();
  for (const f of files) {
    const blob = await downloadFn(f.storagePath);
    if (!blob) continue;
    let name = f.fileName;
    const count = usedNames.get(name) || 0;
    if (count > 0) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
    }
    usedNames.set(f.fileName, count + 1);
    zip.file(name, blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = archiveName.endsWith(".zip") ? archiveName : `${archiveName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

const PREVIEW_IMAGE_EXTS = new Set(["JPG", "JPEG", "PNG", "GIF", "BMP", "WEBP", "SVG"]);
const PREVIEW_TEXT_EXTS = new Set(["SDR", "GSI", "TXT"]);

export function isPreviewable(fileName: string): boolean {
  const ext = getExt(fileName);
  return ext === "PDF" || PREVIEW_IMAGE_EXTS.has(ext) || PREVIEW_TEXT_EXTS.has(ext);
}

export function getPreviewType(fileName: string): "pdf" | "image" | "text" | null {
  const ext = getExt(fileName);
  if (ext === "PDF") return "pdf";
  if (PREVIEW_IMAGE_EXTS.has(ext)) return "image";
  if (PREVIEW_TEXT_EXTS.has(ext)) return "text";
  return null;
}

export async function getStorageBlobUrl(storagePath: string): Promise<string | null> {
  const { downloadFile } = await import("@/lib/fileStorage");
  const data = await downloadFile(storagePath);
  if (!data) return null;
  return URL.createObjectURL(data);
}

export async function getStorageTextContent(storagePath: string): Promise<string | null> {
  const { downloadFile } = await import("@/lib/fileStorage");
  const data = await downloadFile(storagePath);
  if (!data) return null;
  return await data.text();
}

export const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
