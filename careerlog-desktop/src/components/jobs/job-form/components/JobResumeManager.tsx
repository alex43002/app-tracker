import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import {
  deleteJobResume,
  fetchJobResumes,
  fetchResumePreviewUrl,
  uploadJobResume,
} from "../../../../api/jobs";
import { ApiError } from "../../../../api/client";
import type { JobResume } from "../../../../types/job";

/**
 * JobResumeManager (FEAT-10)
 *
 * Lists, uploads, previews, and deletes the multiple résumés attached to a job.
 * Only rendered in edit mode (uploads need an existing job id); the create form
 * still attaches the first résumé via the single ResumeField.
 */
export function JobResumeManager({ jobId }: { jobId: string }) {
  const [resumes, setResumes] = useState<JobResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetchJobResumes(jobId)
      .then((r) => {
        if (active) {
          setResumes(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const entry = await uploadJobResume(jobId, file);
      setResumes((prev) => [...prev, entry]);
      toast.success("Résumé added");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.displayMessage : "Failed to upload résumé"
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteJobResume(jobId, id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("Failed to delete résumé");
    }
  }

  async function handlePreview(id: string) {
    const url = await fetchResumePreviewUrl(id);
    if (!url) {
      toast.error("Couldn't open preview");
      return;
    }
    // Open in a new window; revoke shortly after so the blob isn't leaked.
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="rounded-md border border-dashed p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">Attached résumés</h4>
        <label className="cursor-pointer rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
          {uploading ? "Uploading…" : "+ Add résumé"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-gray-500">Loading résumés…</p>
      ) : resumes.length === 0 ? (
        <p className="text-xs text-gray-500">
          No résumés attached yet. Add one above.
        </p>
      ) : (
        <ul className="divide-y">
          {resumes.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="truncate">{r.filename ?? r.id}</span>
              <span className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handlePreview(r.id)}
                  className="text-blue-600 hover:underline"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
