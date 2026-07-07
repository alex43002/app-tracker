import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { AppLayout } from "../layouts/AppLayout";
import {
  createStarStory,
  deleteStarStory,
  fetchStarStories,
  updateStarStory,
} from "../api/starStories";
import { confirm } from "../components/common/dialogs/confirmController";
import type { StarStory, StarStoryInput } from "../types/starStory";

/* ============================================================
   STAR story library (interview prep)

   Organize reusable Situation / Task / Action / Result stories for
   behavioral interview questions, with tags for quick reuse.
============================================================ */

const EMPTY: StarStoryInput = {
  title: "",
  situation: "",
  task: "",
  action: "",
  result: "",
  tags: [],
};

const STAR_FIELDS: {
  key: keyof StarStoryInput;
  label: string;
  hint: string;
}[] = [
  { key: "situation", label: "Situation", hint: "Set the scene and context" },
  { key: "task", label: "Task", hint: "What you were responsible for" },
  { key: "action", label: "Action", hint: "What you actually did" },
  { key: "result", label: "Result", hint: "The measurable outcome" },
];

export function Stories() {
  const [stories, setStories] = useState<StarStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StarStoryInput>(EMPTY);
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchStarStories()
      .then(setStories)
      .catch(() => toast.error("Failed to load stories"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [stories, search]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setTagText("");
  }

  function startEdit(story: StarStory) {
    setEditingId(story.id);
    setForm({
      title: story.title,
      situation: story.situation,
      task: story.task,
      action: story.action,
      result: story.result,
      tags: story.tags,
    });
    setTagText(story.tags.join(", "));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("A title is required");
      return;
    }
    const payload: StarStoryInput = {
      ...form,
      title: form.title.trim(),
      tags: tagText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateStarStory(editingId, payload);
        setStories((prev) =>
          prev.map((s) => (s.id === editingId ? updated : s)),
        );
        toast.success("Story updated");
      } else {
        const created = await createStarStory(payload);
        setStories((prev) => [created, ...prev]);
        toast.success("Story added");
      }
      resetForm();
    } catch {
      toast.error("Failed to save story");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(story: StarStory) {
    const ok = await confirm({
      title: "Delete story",
      description: `Delete "${story.title}"? This can't be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteStarStory(story.id);
      setStories((prev) => prev.filter((s) => s.id !== story.id));
      if (editingId === story.id) resetForm();
      toast.success("Story deleted");
    } catch {
      toast.error("Failed to delete story");
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto grid h-full w-full max-w-6xl gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
        {/* List */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold">STAR stories</h1>
            <p className="text-sm text-gray-500">
              Reusable Situation · Task · Action · Result stories for behavioral
              interview questions.
            </p>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or tag…"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />

          {loading ? (
            <div className="rounded border p-6 text-sm text-gray-500">
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
              {stories.length === 0
                ? "No stories yet — add your first one on the right."
                : "No stories match your search."}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filtered.map((story) => (
                <li
                  key={story.id}
                  className="rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {story.title}
                    </h3>
                    <div className="flex shrink-0 gap-2 text-xs">
                      <button
                        onClick={() => startEdit(story)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(story)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {story.tags.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {story.tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    {STAR_FIELDS.map(({ key, label }) =>
                      story[key] ? (
                        <div key={key}>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {label}
                          </dt>
                          <dd className="whitespace-pre-wrap text-gray-700">
                            {story[key] as string}
                          </dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <form
          onSubmit={handleSave}
          className="flex h-fit flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-6"
        >
          <h2 className="font-semibold text-gray-900">
            {editingId ? "Edit story" : "New story"}
          </h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Title</span>
            <input
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              placeholder="e.g. Resolved a production outage"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          {STAR_FIELDS.map(({ key, label, hint }) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                {label}{" "}
                <span className="font-normal text-gray-400">— {hint}</span>
              </span>
              <textarea
                value={form[key] as string}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                rows={2}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              Tags{" "}
              <span className="font-normal text-gray-400">
                (comma-separated)
              </span>
            </span>
            <input
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="leadership, conflict, teamwork"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add story"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-500 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
