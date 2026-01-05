import { useEffect, useState } from "react";
import type { Job } from "../../types/job";
import type {
  CreateJobPayload,
  UpdateJobPayload,
} from "../../api/jobs";

interface JobFormModalProps {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onSave: (payload: CreateJobPayload | UpdateJobPayload) => void;
}

const EMPTY_FORM: CreateJobPayload = {
  jobId: null,
  url: "",
  jobTitle: "",
  company: "",
  salaryTarget: 0,
  salaryRange: null,
  status: "applied",
  resume: "",
  location: "",
  employmentType: "full-time",
};

export function JobFormModal({
  open,
  job,
  onClose,
  onSave,
}: JobFormModalProps) {
  const [form, setForm] = useState<CreateJobPayload>(EMPTY_FORM);

  /* ============================================================
     Prefill for edit mode
  ============================================================ */

  useEffect(() => {
    if (job) {
      setForm({
        jobId: job.jobId ?? null,
        url: job.url,
        jobTitle: job.jobTitle,
        company: job.company,
        salaryTarget: job.salaryTarget,
        salaryRange: job.salaryRange ?? null,
        status: job.status,
        resume: job.resume,
        location: job.location,
        employmentType: job.employmentType,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [job]);

  if (!open) return null;

  /* ============================================================
     Save handler
  ============================================================ */

  function handleSave() {
    if (job) {
      /* -------------------------------
         UPDATE → diff only
      -------------------------------- */

      const updatePayload: UpdateJobPayload = {};

      (Object.keys(form) as (keyof CreateJobPayload)[]).forEach(
        (key) => {
          if (form[key] !== (job as any)[key]) {
            (updatePayload as any)[key] = form[key];
          }
        }
      );

      onSave(updatePayload);
    } else {
      /* -------------------------------
         CREATE → full payload
      -------------------------------- */

      onSave(form);
    }
  }

  /* ============================================================
     UI
  ============================================================ */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-md bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {job ? "Edit Job" : "Add Job"}
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Company */}
          <input
            placeholder="Company *"
            value={form.company}
            onChange={(e) =>
              setForm({ ...form, company: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Job Title */}
          <input
            placeholder="Job Title *"
            value={form.jobTitle}
            onChange={(e) =>
              setForm({ ...form, jobTitle: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Job ID */}
          <input
            placeholder="Internal Job ID"
            value={form.jobId ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                jobId: e.target.value || null,
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* URL */}
          <input
            placeholder="Job URL *"
            value={form.url}
            onChange={(e) =>
              setForm({ ...form, url: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Location */}
          <input
            placeholder="Location *"
            value={form.location}
            onChange={(e) =>
              setForm({ ...form, location: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Employment Type */}
          <select
            value={form.employmentType}
            onChange={(e) =>
              setForm({
                ...form,
                employmentType: e.target.value,
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>

          {/* Salary Target */}
          <input
            type="number"
            placeholder="Salary Target *"
            value={form.salaryTarget}
            onChange={(e) =>
              setForm({
                ...form,
                salaryTarget: Number(e.target.value),
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Salary Range */}
          <input
            placeholder="Salary Range (e.g. 100k–140k)"
            value={form.salaryRange ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                salaryRange: e.target.value || null,
              })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Resume */}
          <input
            placeholder="Resume Used *"
            value={form.resume}
            onChange={(e) =>
              setForm({ ...form, resume: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          />

          {/* Status */}
          <select
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value })
            }
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="applied">Applied</option>
            <option value="interviewing">Interviewing</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-black px-4 py-2 text-sm text-white"
          >
            Save Job
          </button>
        </div>
      </div>
    </div>
  );
}
