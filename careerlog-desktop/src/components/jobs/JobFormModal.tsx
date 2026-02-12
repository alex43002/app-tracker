import { useEffect, useRef, useState } from "react";
import type { Job } from "../../types/job";
import type {
  CreateJobPayload,
  UpdateJobPayload,
} from "../../api/jobs";

import { JobForm, type JobFormHandle } from "./job-form/components/JobForm";

/* ============================================================
   Types
============================================================ */

interface JobFormModalProps {
  open: boolean;
  job: Job | null;
  onClose: () => void;
  onSave: (payload: CreateJobPayload | UpdateJobPayload) => void;
}

/* ============================================================
   Component
============================================================ */

export function JobFormModal({
  open,
  job,
  onClose,
  onSave,
}: JobFormModalProps) {
  const [isVisible, setIsVisible] = useState(open);
  const [isAnimating, setIsAnimating] = useState(false);
  const formRef = useRef<JobFormHandle>(null);
  /* ============================
     Mount / Unmount w/ Animation
  ============================ */

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  if (!isVisible) return null;

  /* ============================
     Render
  ============================ */

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center px-4
        transition-opacity duration-300
        ${isAnimating ? "opacity-100" : "opacity-0"}
        bg-black/40
      `}
    >
      <div
        className={`
          w-full max-w-3xl rounded-lg bg-white shadow-lg
          transform transition-all duration-300
          ${
            isAnimating
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }
        `}
      >
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">
            {job ? "Edit Job" : "Add Job"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Enter job application details
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <JobForm
            ref={formRef} 
            job={job}
            onSave={(payload) => onSave(payload)}
          />
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
            onClick={() => {
              formRef.current?.submit()
            }}
            className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Save Job
          </button>
        </div>
      </div>
    </div>
  );
}
