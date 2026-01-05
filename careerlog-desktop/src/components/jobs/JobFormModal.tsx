import { useEffect, useMemo, useState } from "react";
import type { Job } from "../../types/job";
import type {
  CreateJobPayload,
  UpdateJobPayload,
} from "../../api/jobs";

/* ============================================================
   Types
============================================================ */

interface JobFormModalProps {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onSave: (payload: CreateJobPayload | UpdateJobPayload) => void;
}

type FormErrors = Partial<Record<keyof CreateJobPayload, string>>;

/* ============================================================
   Constants
============================================================ */

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

/* ============================================================
   Component
============================================================ */

export function JobFormModal({
  open,
  job,
  onClose,
  onSave,
}: JobFormModalProps) {
  const [form, setForm] = useState<CreateJobPayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const isEdit = Boolean(job);

  /* ================= Prefill ================= */

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
    setErrors({});
  }, [job]);

  if (!open) return null;

  /* ================= Validation ================= */

  const validate = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!form.company.trim()) nextErrors.company = "Company is required";
    if (!form.jobTitle.trim()) nextErrors.jobTitle = "Job title is required";
    if (!form.url.trim()) nextErrors.url = "Job URL is required";
    if (!form.location.trim()) nextErrors.location = "Location is required";
    if (!form.resume.trim()) nextErrors.resume = "Resume is required";
    if (form.salaryTarget <= 0)
      nextErrors.salaryTarget = "Salary target must be greater than 0";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /* ================= Save ================= */

  function handleSave() {
    if (!validate()) return;

    if (isEdit && job) {
      const updatePayload: UpdateJobPayload = {};

      (Object.keys(form) as (keyof CreateJobPayload)[]).forEach((key) => {
        if (form[key] !== (job as any)[key]) {
          (updatePayload as any)[key] = form[key];
        }
      });

      onSave(updatePayload);
    } else {
      onSave(form);
    }
  }

  /* ================= Render ================= */

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit Job" : "Add Job"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter job application details
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-8">
          <FormSection title="Job Information">
            <TextInput
              label="Company"
              value={form.company}
              error={errors.company}
              onChange={(v) => setForm({ ...form, company: v })}
            />

            <TextInput
              label="Job Title"
              value={form.jobTitle}
              error={errors.jobTitle}
              onChange={(v) => setForm({ ...form, jobTitle: v })}
            />

            <TextInput
              label="Job URL"
              value={form.url}
              error={errors.url}
              onChange={(v) => setForm({ ...form, url: v })}
            />

            <TextInput
              label="Internal Job ID"
              value={form.jobId ?? ""}
              onChange={(v) =>
                setForm({ ...form, jobId: v || null })
              }
            />

            <TextInput
              label="Location"
              value={form.location}
              error={errors.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />

            <SelectInput
              label="Employment Type"
              value={form.employmentType}
              options={[
                { value: "full-time", label: "Full-time" },
                { value: "part-time", label: "Part-time" },
                { value: "contract", label: "Contract" },
                { value: "internship", label: "Internship" },
              ]}
              onChange={(v) =>
                setForm({ ...form, employmentType: v })
              }
            />
          </FormSection>

          <FormSection title="Compensation">
            <TextInput
              label="Salary Target"
              type="number"
              value={String(form.salaryTarget)}
              error={errors.salaryTarget}
              onChange={(v) =>
                setForm({ ...form, salaryTarget: Number(v) })
              }
            />

            <TextInput
              label="Salary Range"
              value={form.salaryRange ?? ""}
              onChange={(v) =>
                setForm({
                  ...form,
                  salaryRange: v || null,
                })
              }
            />
          </FormSection>

          <FormSection title="Application Details">
            <TextInput
              label="Resume Used"
              value={form.resume}
              error={errors.resume}
              onChange={(v) => setForm({ ...form, resume: v })}
            />

            <SelectInput
              label="Status"
              value={form.status}
              options={[
                { value: "applied", label: "Applied" },
                { value: "interviewing", label: "Interviewing" },
                { value: "offer", label: "Offer" },
                { value: "rejected", label: "Rejected" },
              ]}
              onChange={(v) =>
                setForm({ ...form, status: v })
              }
            />
          </FormSection>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Save Job
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Subcomponents
============================================================ */

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold text-gray-700">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <FormField label={label} error={error}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
          error
            ? "border-red-500 focus:ring-red-200"
            : "focus:ring-black/20"
        }`}
      />
    </FormField>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
