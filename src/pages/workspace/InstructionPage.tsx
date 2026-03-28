import { useState, useRef, useCallback } from "react";
import { useProject } from "@/lib/ProjectContext";
import { useMobile } from "@/lib/MobileContext";
import GeneralInstruction from "@/components/instruction/GeneralInstruction";
import RegistryInstruction from "@/components/instruction/RegistryInstruction";
import TasksInstruction from "@/components/instruction/TasksInstruction";
import GroInstruction from "@/components/instruction/GroInstruction";
import NavigationInstruction from "@/components/instruction/NavigationInstruction";
import RequestsInstruction from "@/components/instruction/RequestsInstruction";
import FileShareInstruction from "@/components/instruction/FileShareInstruction";
import AdminInstruction from "@/components/instruction/AdminInstruction";

type SectionId = "general" | "registry" | "tasks" | "gro" | "navigation" | "requests" | "fileshare" | "admin";

export default function InstructionPage() {
  const { isProjectAdmin, hasPermission } = useProject();
  const { isMobile } = useMobile();
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const contentRef = useRef<HTMLDivElement>(null);

  const canViewRequests = hasPermission("can_view_requests");
  const canSeeTasks = hasPermission("can_view_tasks");

  const sections: { id: SectionId; title: string }[] = [
    { id: "general", title: "Общее" },
    { id: "registry", title: "Реестр" },
    ...(canSeeTasks ? [{ id: "tasks" as const, title: "Задачи" }] : []),
    { id: "gro", title: "ГРО" },
    { id: "navigation", title: "Проводник, План, Шахматка" },
    ...(canViewRequests ? [{ id: "requests" as const, title: "Заявки" }] : []),
    { id: "fileshare", title: "Файлообмен" },
    ...(isProjectAdmin ? [{ id: "admin" as const, title: "Админ" }] : []),
  ];

  const handleDownloadPdf = useCallback(() => {
    if (!contentRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = contentRef.current.innerHTML;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Инструкция пользователя — DocStroy</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 32px; line-height: 1.6; font-size: 13px; }
  h3 { font-size: 18px; margin-bottom: 8px; page-break-after: avoid; }
  h4 { font-size: 14px; margin-bottom: 6px; page-break-after: avoid; }
  p { margin-bottom: 4px; }
  .space-y-6 > * + * { margin-top: 20px; }
  .space-y-4 > * + * { margin-top: 14px; }
  .space-y-3 > * + * { margin-top: 10px; }
  .space-y-2 > * + * { margin-top: 6px; }
  .space-y-1 > * + * { margin-top: 3px; }
  .rounded-xl, .rounded-lg { border-radius: 8px; }
  .rounded-full { border-radius: 999px; }
  .font-semibold, .font-bold { font-weight: 600; }
  .text-xl { font-size: 18px; }
  .text-sm { font-size: 12px; }
  .text-xs { font-size: 11px; }
  .text-\\[11px\\] { font-size: 11px; }
  .text-\\[10px\\] { font-size: 10px; }
  .flex { display: flex; }
  .flex-wrap { flex-wrap: wrap; }
  .items-center { align-items: center; }
  .items-start { align-items: flex-start; }
  .gap-1 { gap: 4px; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .gap-4 { gap: 16px; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: 1fr 1fr; }
  .p-2, .p-2\\.5 { padding: 8px; }
  .p-3 { padding: 12px; }
  .p-4 { padding: 16px; }
  .p-5 { padding: 20px; }
  .px-2, .px-3 { padding-left: 8px; padding-right: 8px; }
  .py-1, .py-0\\.5 { padding-top: 4px; padding-bottom: 4px; }
  .py-2 { padding-top: 8px; padding-bottom: 8px; }
  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .mt-1 { margin-top: 4px; }
  .mt-2 { margin-top: 8px; }
  .mt-3 { margin-top: 12px; }
  .shrink-0 { flex-shrink: 0; }
  .w-5, .h-5 { width: 20px; height: 20px; }
  .w-6, .h-6 { width: 24px; height: 24px; }
  .w-8, .h-8 { width: 32px; height: 32px; }
  .w-10, .h-10 { width: 40px; height: 40px; }
  svg { display: inline-block; vertical-align: middle; }
  [style*="background"] { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  @media print {
    body { padding: 16px; font-size: 11px; }
    .space-y-6 > * + * { margin-top: 14px; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
<h1 style="text-align:center;margin-bottom:24px;font-size:22px;">Инструкция пользователя — DocStroy</h1>
${content}
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Инструкция</h2>
        <button
          onClick={handleDownloadPdf}
          className="ds-btn flex items-center gap-2 text-sm"
          title="Скачать инструкцию в PDF"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Скачать PDF
        </button>
      </div>

      {/* Табы */}
      <div className={`${isMobile ? "flex overflow-x-auto -mx-1 px-1 pb-1" : "flex flex-wrap"} gap-1 rounded-xl p-1`} style={{ background: "var(--ds-surface-sunken)" }}>
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`${isMobile ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} font-medium rounded-lg transition-all duration-200 whitespace-nowrap ${
              activeSection === s.id ? "ds-btn shadow-sm" : "hover:bg-white/50"
            }`}
            style={activeSection !== s.id ? { color: "var(--ds-text-muted)" } : undefined}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Содержимое */}
      <div ref={contentRef} className={`ds-card ${isMobile ? "p-3" : "p-6"} min-h-[60vh]`}>
        {activeSection === "general" && <GeneralInstruction />}
        {activeSection === "registry" && <RegistryInstruction />}
        {activeSection === "tasks" && <TasksInstruction />}
        {activeSection === "gro" && <GroInstruction />}
        {activeSection === "navigation" && <NavigationInstruction />}
        {activeSection === "requests" && canViewRequests && <RequestsInstruction />}
        {activeSection === "fileshare" && <FileShareInstruction />}
        {activeSection === "admin" && isProjectAdmin && <AdminInstruction />}
      </div>
    </div>
  );
}
