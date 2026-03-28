import React from "react";

export function StepCard({ step, title, children, color = "blue" }: {
  step: number;
  title: string;
  children: React.ReactNode;
  color?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const gradients = {
    blue: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))",
    green: "linear-gradient(135deg, #22c55e, #16a34a)",
    amber: "linear-gradient(135deg, #f59e0b, #d97706)",
    red: "linear-gradient(135deg, #ef4444, #dc2626)",
    purple: "linear-gradient(135deg, #a855f7, #9333ea)",
  };

  const glows = {
    blue: "0 4px 14px color-mix(in srgb, var(--ds-accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)",
    green: "0 4px 14px rgba(34, 197, 94, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
    amber: "0 4px 14px rgba(245, 158, 11, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
    red: "0 4px 14px rgba(239, 68, 68, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
    purple: "0 4px 14px rgba(168, 85, 247, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
  };

  return (
    <div className="group animate-fadeIn" style={{ animationDelay: `${step * 100}ms` }}>
      <div className="flex gap-4 items-start">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 group-hover:scale-110 transition-transform"
          style={{
            background: gradients[color],
            boxShadow: glows[color],
          }}
        >
          {step}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold mb-2" style={{ color: "var(--ds-text)" }}>{title}</h4>
          <div className="text-sm leading-relaxed" style={{ color: "var(--ds-text-muted)" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

export function MockButton({ children, variant = "blue" }: { children: React.ReactNode; variant?: "blue" | "green" | "amber" | "red" | "gray" }) {
  const styles: Record<string, { background: string; boxShadow: string; color: string }> = {
    blue: {
      background: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))",
      boxShadow: "0 2px 8px color-mix(in srgb, var(--ds-accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)",
      color: "white",
    },
    green: {
      background: "linear-gradient(135deg, #22c55e, #16a34a)",
      boxShadow: "0 2px 8px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
      color: "white",
    },
    amber: {
      background: "linear-gradient(135deg, #f59e0b, #d97706)",
      boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
      color: "white",
    },
    red: {
      background: "linear-gradient(135deg, #ef4444, #dc2626)",
      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
      color: "white",
    },
    gray: {
      background: "linear-gradient(135deg, var(--ds-surface-elevated), var(--ds-surface))",
      boxShadow: "0 2px 6px hsl(var(--ds-shadow-color) / 0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
      color: "var(--ds-text)",
    },
  };

  const s = styles[variant];

  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium"
      style={{ background: s.background, boxShadow: s.boxShadow, color: s.color }}
    >
      {children}
    </span>
  );
}

export function InfoBadge({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "amber" | "red" | "purple" }) {
  const styles: Record<string, { background: string; color: string; border: string; boxShadow: string }> = {
    blue: {
      background: "linear-gradient(135deg, color-mix(in srgb, var(--ds-accent) 10%, var(--ds-surface)), color-mix(in srgb, var(--ds-accent) 6%, var(--ds-surface)))",
      color: "var(--ds-accent-light)",
      border: "1px solid color-mix(in srgb, var(--ds-accent) 20%, transparent)",
      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--ds-accent) 8%, transparent)",
    },
    green: {
      background: "linear-gradient(135deg, color-mix(in srgb, #22c55e 10%, var(--ds-surface)), color-mix(in srgb, #22c55e 6%, var(--ds-surface)))",
      color: "#22c55e",
      border: "1px solid color-mix(in srgb, #22c55e 20%, transparent)",
      boxShadow: "inset 0 1px 0 rgba(34, 197, 94, 0.08)",
    },
    amber: {
      background: "linear-gradient(135deg, color-mix(in srgb, #f59e0b 10%, var(--ds-surface)), color-mix(in srgb, #f59e0b 6%, var(--ds-surface)))",
      color: "#f59e0b",
      border: "1px solid color-mix(in srgb, #f59e0b 20%, transparent)",
      boxShadow: "inset 0 1px 0 rgba(245, 158, 11, 0.08)",
    },
    red: {
      background: "linear-gradient(135deg, color-mix(in srgb, #ef4444 10%, var(--ds-surface)), color-mix(in srgb, #ef4444 6%, var(--ds-surface)))",
      color: "#ef4444",
      border: "1px solid color-mix(in srgb, #ef4444 20%, transparent)",
      boxShadow: "inset 0 1px 0 rgba(239, 68, 68, 0.08)",
    },
    purple: {
      background: "linear-gradient(135deg, color-mix(in srgb, #a855f7 10%, var(--ds-surface)), color-mix(in srgb, #a855f7 6%, var(--ds-surface)))",
      color: "#a855f7",
      border: "1px solid color-mix(in srgb, #a855f7 20%, transparent)",
      boxShadow: "inset 0 1px 0 rgba(168, 85, 247, 0.08)",
    },
  };

  const s = styles[color];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: s.background, color: s.color, border: s.border, boxShadow: s.boxShadow }}
    >
      {children}
    </span>
  );
}

export function Illustration({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 ds-card">
      {children}
    </div>
  );
}

export function FlowDiagram({ items }: { items: { label: string; color: string; icon: React.ReactNode }[] }) {
  const getGradientStyle = (color: string) => {
    if (color.includes("blue")) return {
      background: "linear-gradient(135deg, color-mix(in srgb, var(--ds-accent) 15%, var(--ds-surface)), color-mix(in srgb, var(--ds-accent) 8%, var(--ds-surface)))",
      color: "var(--ds-accent)",
      boxShadow: "0 2px 8px color-mix(in srgb, var(--ds-accent) 15%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
    if (color.includes("green") || color.includes("emerald")) return {
      background: "linear-gradient(135deg, color-mix(in srgb, #22c55e 15%, var(--ds-surface)), color-mix(in srgb, #22c55e 8%, var(--ds-surface)))",
      color: "#22c55e",
      boxShadow: "0 2px 8px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
    if (color.includes("amber")) return {
      background: "linear-gradient(135deg, color-mix(in srgb, #f59e0b 15%, var(--ds-surface)), color-mix(in srgb, #f59e0b 8%, var(--ds-surface)))",
      color: "#f59e0b",
      boxShadow: "0 2px 8px rgba(245, 158, 11, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
    if (color.includes("red")) return {
      background: "linear-gradient(135deg, color-mix(in srgb, #ef4444 15%, var(--ds-surface)), color-mix(in srgb, #ef4444 8%, var(--ds-surface)))",
      color: "#ef4444",
      boxShadow: "0 2px 8px rgba(239, 68, 68, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
    if (color.includes("purple")) return {
      background: "linear-gradient(135deg, color-mix(in srgb, #a855f7 15%, var(--ds-surface)), color-mix(in srgb, #a855f7 8%, var(--ds-surface)))",
      color: "#a855f7",
      boxShadow: "0 2px 8px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
    return {
      background: "linear-gradient(135deg, var(--ds-surface-elevated), var(--ds-surface))",
      color: "var(--ds-text-muted)",
      boxShadow: "0 2px 6px hsl(var(--ds-shadow-color) / 0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
    };
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-3">
      {items.map((item, i) => {
        const gradStyle = getGradientStyle(item.color);
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium animate-fadeIn"
              style={{ ...gradStyle, animationDelay: `${i * 150}ms`, border: "1px solid var(--ds-border)" }}
            >
              {item.icon}
              {item.label}
            </div>
            {i < items.length - 1 && (
              <svg className="w-5 h-5 shrink-0 animate-pulse" style={{ color: "var(--ds-text-faint)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function MockUI({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ds-card overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--ds-surface-elevated)", borderBottom: "1px solid var(--ds-border)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#4ade80" }} />
        </div>
        <span className="text-xs font-medium ml-2" style={{ color: "var(--ds-text-muted)" }}>{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function FeatureCard({ icon, title, children, color, delay }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  color: "blue" | "purple" | "amber" | "green" | "gray";
  delay: number;
}) {
  const iconGradients: Record<string, { background: string; color: string; boxShadow: string }> = {
    blue: {
      background: "linear-gradient(135deg, var(--ds-accent), var(--ds-accent-dark))",
      color: "white",
      boxShadow: "0 3px 10px color-mix(in srgb, var(--ds-accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)",
    },
    purple: {
      background: "linear-gradient(135deg, #a855f7, #9333ea)",
      color: "white",
      boxShadow: "0 3px 10px rgba(168, 85, 247, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
    },
    amber: {
      background: "linear-gradient(135deg, #f59e0b, #d97706)",
      color: "white",
      boxShadow: "0 3px 10px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
    },
    green: {
      background: "linear-gradient(135deg, #22c55e, #16a34a)",
      color: "white",
      boxShadow: "0 3px 10px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
    },
    gray: {
      background: "linear-gradient(135deg, var(--ds-surface-elevated), var(--ds-border))",
      color: "var(--ds-text)",
      boxShadow: "0 3px 10px hsl(var(--ds-shadow-color) / 0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
    },
  };

  const ic = iconGradients[color];

  return (
    <div className="ds-card p-4 animate-fadeIn" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: ic.background, color: ic.color, boxShadow: ic.boxShadow }}
        >
          {icon}
        </div>
        <h4 className="font-semibold" style={{ color: "var(--ds-text)" }}>{title}</h4>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--ds-text-muted)" }}>{children}</p>
    </div>
  );
}
