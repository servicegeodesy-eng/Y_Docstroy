import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CellPermissionsEditor from "./CellPermissionsEditor";

interface Project {
  id: string;
  name: string;
}

interface Props {
  onClose: () => void;
}

export default function CellPermissionsPage({ onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id, name")
      .order("name")
      .then(({ data }) => {
        const list = (data || []) as Project[];
        setProjects(list);
        if (list.length > 0) setSelectedProjectId(list[0].id);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--ds-surface)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: "1px solid var(--ds-border)" }}>
        <button onClick={onClose} className="ds-icon-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Разрешения ячеек</h2>
        <div className="flex-1" />
        {!loading && (
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="ds-input w-auto max-w-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="ds-spinner mx-auto mb-3" />
            <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Загрузка...</p>
          </div>
        ) : selectedProjectId ? (
          <CellPermissionsEditor key={selectedProjectId} projectId={selectedProjectId} onBack={onClose} />
        ) : (
          <p className="text-sm" style={{ color: "var(--ds-text-faint)" }}>Нет проектов</p>
        )}
      </div>
    </div>
  );
}
