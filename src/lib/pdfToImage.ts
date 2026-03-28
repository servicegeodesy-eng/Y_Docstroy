import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerCode from "pdfjs-dist/build/pdf.worker.min.mjs?raw";

// Создаём Blob URL из кода worker — обходит проблему MIME-типа на сервере
const workerBlob = new Blob([pdfWorkerCode], { type: "application/javascript" });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

/**
 * Конвертирует первую страницу PDF-файла в PNG-изображение.
 * Возвращает File с типом image/png и размеры изображения.
 */
export async function pdfToImage(
  pdfFile: File,
  scale = 2,
): Promise<{ file: File; width: number; height: number }> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
  }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale });

  const w = Math.round(viewport.width);
  const h = Math.round(viewport.height);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/png"),
  );

  const baseName = pdfFile.name.replace(/\.pdf$/i, "");
  const file = new File([blob], `${baseName}.png`, { type: "image/png" });

  return { file, width: w, height: h };
}

/** Проверяет, является ли файл PDF */
export function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}
