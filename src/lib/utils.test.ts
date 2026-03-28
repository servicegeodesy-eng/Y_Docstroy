import { describe, it, expect } from "vitest";
import { shortName, formatSize, getExt, isPreviewable, getPreviewType } from "./utils";

describe("shortName", () => {
  it("форматирует ФИО с отчеством", () => {
    expect(shortName({ last_name: "Иванов", first_name: "Иван", middle_name: "Иванович" }))
      .toBe("Иванов И.И.");
  });

  it("форматирует ФИО без отчества", () => {
    expect(shortName({ last_name: "Петров", first_name: "Пётр", middle_name: null }))
      .toBe("Петров П.");
  });

  it("возвращает пустую строку для null", () => {
    expect(shortName(null)).toBe("");
  });
});

describe("formatSize", () => {
  it("форматирует байты", () => {
    expect(formatSize(500)).toBe("500 Б");
  });

  it("форматирует килобайты", () => {
    expect(formatSize(1536)).toBe("1.5 КБ");
  });

  it("форматирует мегабайты", () => {
    expect(formatSize(2 * 1024 * 1024)).toBe("2.0 МБ");
  });
});

describe("getExt", () => {
  it("возвращает расширение в верхнем регистре", () => {
    expect(getExt("document.pdf")).toBe("PDF");
  });

  it("обрабатывает файл без расширения", () => {
    expect(getExt("README")).toBe("README");
  });

  it("обрабатывает множественные точки", () => {
    expect(getExt("archive.tar.gz")).toBe("GZ");
  });
});

describe("isPreviewable", () => {
  it("PDF — предпросмотр доступен", () => {
    expect(isPreviewable("doc.pdf")).toBe(true);
  });

  it("JPG — предпросмотр доступен", () => {
    expect(isPreviewable("photo.jpg")).toBe(true);
  });

  it("XLSX — предпросмотр не доступен", () => {
    expect(isPreviewable("table.xlsx")).toBe(false);
  });

  it("SDR — текстовый предпросмотр доступен", () => {
    expect(isPreviewable("data.sdr")).toBe(true);
  });
});

describe("getPreviewType", () => {
  it("PDF → pdf", () => {
    expect(getPreviewType("doc.pdf")).toBe("pdf");
  });

  it("PNG → image", () => {
    expect(getPreviewType("img.png")).toBe("image");
  });

  it("TXT → text", () => {
    expect(getPreviewType("readme.txt")).toBe("text");
  });

  it("DOCX → null", () => {
    expect(getPreviewType("file.docx")).toBeNull();
  });
});
