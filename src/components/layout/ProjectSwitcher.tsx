import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { isGeoMode } from "@/lib/geoMode";

interface Props {
  currentName: string;
  description?: string | null;
  className?: string;
  compact?: boolean;
  alignRight?: boolean;
}

export default function ProjectSwitcher({ currentName, description, className = "", compact, alignRight }: Props) {
  const { projectMemberships, isPortalAdmin } = useAuth();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const geo = isGeoMode();

  const hasMultiple = projectMemberships.length > 1;
  const canSwitch = hasMultiple || isPortalAdmin;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function switchTo(id: string) {
    setOpen(false);
    const defaultPage = geo ? "requests" : "registry";
    navigate(`/projects/${id}/${defaultPage}`);
  }

  if (!canSwitch) {
    return (
      <div className={`min-w-0 ${className}`}>
        <h1 className={`font-semibold truncate ${compact ? "text-sm" : "text-base"}`} style={{ color: "var(--ds-text)" }}>
          {currentName}
        </h1>
        {!compact && description && (
          <p className="text-xs line-clamp-1" style={{ color: "var(--ds-text-muted)" }}>{description}</p>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={`relative min-w-0 ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 min-w-0 group"
      >
        <h1 className={`font-semibold truncate ${compact ? "text-sm" : "text-base"} group-hover:opacity-80 transition-opacity`} style={{ color: "var(--ds-text)" }}>
          {currentName}
        </h1>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--ds-text-faint)" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!compact && description && (
        <p className="text-xs line-clamp-1" style={{ color: "var(--ds-text-muted)" }}>{description}</p>
      )}

      {open && (
        <div
          className={`absolute top-full mt-1 w-64 max-w-[calc(100vw-2rem)] max-h-80 overflow-y-auto rounded-xl shadow-lg z-50 py-1 ${alignRight ? "right-0" : "left-0"}`}
          style={{ background: "var(--ds-surface-elevated)", border: "1px solid var(--ds-border)" }}
        >
          {projectMemberships.map((m) => (
            <button
              key={m.project_id}
              onClick={() => switchTo(m.project_id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                m.project_id === projectId ? "font-semibold" : ""
              }`}
              style={{
                color: m.project_id === projectId ? "var(--ds-accent)" : "var(--ds-text)",
                background: m.project_id === projectId ? "color-mix(in srgb, var(--ds-accent) 8%, transparent)" : undefined,
              }}
              onMouseEnter={(e) => {
                if (m.project_id !== projectId) (e.target as HTMLElement).style.background = "var(--ds-surface-sunken)";
              }}
              onMouseLeave={(e) => {
                if (m.project_id !== projectId) (e.target as HTMLElement).style.background = "";
              }}
            >
              {m.project_name}
              {m.project_description && (
                <span className="block text-xs mt-0.5" style={{ color: "var(--ds-text-faint)" }}>
                  {m.project_description}
                </span>
              )}
            </button>
          ))}
          {isPortalAdmin && (
            <>
              <div style={{ borderTop: "1px solid var(--ds-border)", margin: "4px 0" }} />
              <button
                onClick={() => { setOpen(false); navigate("/projects"); }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2"
                style={{ color: "var(--ds-text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ds-surface-sunken)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Управление проектами
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
