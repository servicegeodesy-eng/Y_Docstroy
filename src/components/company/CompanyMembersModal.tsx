import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  display_name: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  member: "Участник",
};

export default function CompanyMembersModal({
  company,
  onClose,
}: {
  company: Company;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; email: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [company.id]);

  async function loadMembers() {
    setLoading(true);
    const { data } = await api.get<Member[]>(`/api/companies/${company.id}/members`);
    if (data) setMembers(data);
    setLoading(false);
  }

  async function searchUsers(query: string) {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const { data } = await api.get<{ id: string; display_name: string; email: string }[]>(
      "/api/users/search",
      { q: query }
    );
    if (data) {
      // Исключаем уже добавленных
      const existingIds = new Set(members.map((m) => m.user_id));
      setSearchResults(data.filter((u) => !existingIds.has(u.id)));
    }
  }

  async function handleAdd() {
    if (!selectedUserId) return;
    setAdding(true);
    setError(null);
    const { error: err } = await api.post(`/api/companies/${company.id}/members`, {
      user_id: selectedUserId,
      role: addRole,
    });
    if (err) {
      setError(err);
    } else {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUserId(null);
      setAddRole("member");
      await loadMembers();
    }
    setAdding(false);
  }

  async function handleRemove(userId: string) {
    const { error: err } = await api.delete(`/api/companies/${company.id}/members/${userId}`);
    if (!err) await loadMembers();
  }

  async function handleChangeRole(userId: string, role: string) {
    await api.post(`/api/companies/${company.id}/members`, {
      user_id: userId,
      role,
    });
    await loadMembers();
  }

  return (
    <Modal open onClose={onClose} title={`Участники — ${company.name}`} wide>
      <div className="space-y-4">
        {/* Добавление участника */}
        <div className="space-y-2">
          <label className="ds-label">Добавить участника</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={searchQuery}
                onChange={(e) => searchUsers(e.target.value)}
                className="ds-input w-full"
                placeholder="Поиск по фамилии..."
              />
              {searchResults.length > 0 && (
                <div
                  className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-auto rounded-lg shadow-lg"
                  style={{ background: "var(--ds-surface-raised)", border: "1px solid var(--ds-border)" }}
                >
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setSearchQuery(u.display_name);
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--ds-surface-sunken)] transition-colors"
                      style={{ color: "var(--ds-text)" }}
                    >
                      {u.display_name}
                      <span className="ml-2 text-xs" style={{ color: "var(--ds-text-faint)" }}>
                        {u.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="ds-input w-36"
            >
              <option value="member">Участник</option>
              <option value="admin">Администратор</option>
            </select>
            <button
              onClick={handleAdd}
              disabled={adding || !selectedUserId}
              className="ds-btn shrink-0"
            >
              {adding ? "..." : "Добавить"}
            </button>
          </div>
          {error && <div className="ds-alert-error text-sm">{error}</div>}
        </div>

        {/* Список участников */}
        {loading ? (
          <div className="text-center py-8">
            <div className="ds-spinner mx-auto" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "var(--ds-text-muted)" }}>
            Нет участников
          </p>
        ) : (
          <div className="space-y-1">
            {members.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--ds-surface-sunken)" }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: "var(--ds-text)" }}>
                    {m.display_name}
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--ds-text-faint)" }}>
                    {m.email}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {m.role === "owner" ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: "var(--ds-accent-muted)", color: "var(--ds-accent)" }}
                    >
                      {ROLE_LABELS[m.role]}
                    </span>
                  ) : (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.user_id, e.target.value)}
                        className="ds-input text-xs py-0.5 px-2 w-auto"
                      >
                        <option value="admin">Администратор</option>
                        <option value="member">Участник</option>
                      </select>
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        className="ds-icon-btn !p-1"
                        title="Удалить"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
