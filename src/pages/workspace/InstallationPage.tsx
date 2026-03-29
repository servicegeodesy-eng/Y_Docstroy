import { useState } from "react";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";

export default function InstallationPage() {
  const { project } = useProject();
  const { isMobile } = useMobile();

  if (!project) return null;

  return (
    <div>
      <div className={`flex items-center justify-between ${isMobile ? "mb-3" : "mb-6"}`}>
        <h2 className={`font-semibold ${isMobile ? "text-lg" : "text-xl"}`} style={{ color: "var(--ds-text)" }}>
          Монтаж
        </h2>
        <button className="ds-btn text-sm">+ Новые работы</button>
      </div>

      <div className="ds-card p-8 text-center">
        <svg className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <p className="font-medium mb-1" style={{ color: "var(--ds-text)" }}>Нет запланированных работ</p>
        <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>
          Нажмите «Новые работы» для планирования монтажа
        </p>
      </div>
    </div>
  );
}
