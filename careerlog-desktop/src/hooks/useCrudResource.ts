import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

/* ============================================================
   useCrudResource (AUD-09)

   The desktop "list + editor" pages — Offers, STAR stories, and Alerts —
   each independently repeated the same CRUD scaffolding: load-on-mount, a
   `saving` flag, create-vs-update branching with an optimistic list update,
   delete-then-filter, tracking which row is being edited, and the
   success/error toasts around all of it.

   This hook owns that state machine. Each page keeps its own form state and
   JSX (which genuinely differ — inline form vs modal, comparison table vs
   list), and delegates the shared mechanics here. Adapting an API whose
   create/update responses aren't the full row (e.g. Alerts, whose PUT returns
   only `{ updatedAt }`) is done at the call site by wrapping the raw client
   call — see `Alerts.tsx`.
============================================================ */

/**
 * The slice of an API module this hook drives. Responses are assumed already
 * unwrapped by `apiClient`. `update` may return a partial row (only the
 * server-changed fields); it is merged over the existing item.
 */
export interface CrudApi<T, TInput> {
  list: () => Promise<T[]>;
  create: (input: TInput) => Promise<T>;
  update: (id: string, input: TInput) => Promise<Partial<T>>;
  remove: (id: string) => Promise<unknown>;
}

/** User-facing toast copy for each outcome. */
export interface CrudMessages {
  loadError: string;
  created: string;
  updated: string;
  deleted: string;
  saveError: string;
  deleteError: string;
}

export interface CrudResource<T, TInput> {
  items: T[];
  loading: boolean;
  saving: boolean;
  editingId: string | null;
  /** The row currently being edited, or null. Convenient for modal editors. */
  editingItem: T | null;
  beginEdit: (id: string) => void;
  cancelEdit: () => void;
  /** Update when a row is being edited, otherwise create. Returns success. */
  save: (input: TInput) => Promise<boolean>;
  /**
   * Delete a row by id (the caller owns any confirm dialog). Clears the edit
   * state when the deleted row was the one being edited. Returns success.
   */
  remove: (id: string) => Promise<boolean>;
}

export function useCrudResource<T extends { id: string }, TInput>(
  api: CrudApi<T, TInput>,
  messages: CrudMessages,
): CrudResource<T, TInput> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // `api`/`messages` are built inline per render, so read the load-time copies
  // from refs to keep the mount effect to a single fetch (stable deps).
  const apiRef = useRef(api);
  apiRef.current = api;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    let active = true;
    apiRef.current
      .list()
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch(() => toast.error(messagesRef.current.loadError))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save(input: TInput): Promise<boolean> {
    setSaving(true);
    try {
      if (editingId) {
        const patch = await api.update(editingId, input);
        setItems((prev) =>
          prev.map((it) => (it.id === editingId ? { ...it, ...patch } : it)),
        );
        toast.success(messages.updated);
      } else {
        const created = await api.create(input);
        setItems((prev) => [created, ...prev]);
        toast.success(messages.created);
      }
      setEditingId(null);
      return true;
    } catch {
      toast.error(messages.saveError);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await api.remove(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setEditingId((cur) => (cur === id ? null : cur));
      toast.success(messages.deleted);
      return true;
    } catch {
      toast.error(messages.deleteError);
      return false;
    }
  }

  return {
    items,
    loading,
    saving,
    editingId,
    editingItem: items.find((it) => it.id === editingId) ?? null,
    beginEdit: setEditingId,
    cancelEdit: () => setEditingId(null),
    save,
    remove,
  };
}
