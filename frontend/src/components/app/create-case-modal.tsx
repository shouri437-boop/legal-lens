// ABOUTME: Modal dialog for creating a new investigation case
// ABOUTME: Uses react-hook-form with Zod validation for form handling

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api-client";
import {
  caseCreateSchema,
  type CaseCreateFormData,
} from "@/lib/validations/case";
import type { Case } from "@/types/case";

interface CreateCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newCase: Case) => void;
}

export function CreateCaseModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateCaseModalProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CaseCreateFormData>({
    resolver: zodResolver(caseCreateSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit = async (data: CaseCreateFormData) => {
    try {
      setIsSubmitting(true);
      const newCase = await api.post<Case>("/api/cases", {
        name: data.name,
        description: data.description || null,
      });

      toast.success("Case created successfully");
      reset();
      onOpenChange(false);
      onSuccess?.(newCase);

      // Navigate to the new case
      router.push(`/cases/${newCase.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const errorData = error.data as { detail?: string } | null;
        toast.error(
          errorData?.detail || `Failed to create case: ${error.statusText}`,
        );
      } else {
        toast.error("Failed to create case");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg rounded-2xl shadow-2xl"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between p-6"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h2
              className="text-lg font-medium"
              style={{ color: "var(--foreground)" }}
            >
              Create New Case
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 rounded-lg transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
            {/* Name field */}
            <div>
              <label
                htmlFor="case-name"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Case Name <span className="text-red-400">*</span>
              </label>
              <input
                id="case-name"
                type="text"
                autoFocus
                placeholder="e.g., Acme Corp Investigation"
                {...register("name")}
                className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: "var(--background)",
                  border: errors.name
                    ? "1px solid rgba(239, 68, 68, 0.5)"
                    : "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description field */}
            <div>
              <label
                htmlFor="case-description"
                className="block text-sm font-medium mb-2"
                style={{ color: "var(--foreground)" }}
              >
                Description
                <span
                  className="font-normal ml-1"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  (optional)
                </span>
              </label>
              <textarea
                id="case-description"
                rows={4}
                placeholder="Describe the case context..."
                {...register("description")}
                className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition-colors"
                style={{
                  backgroundColor: "var(--background)",
                  border: errors.description
                    ? "1px solid rgba(239, 68, 68, 0.5)"
                    : "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <p
                className="mt-2 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                This context helps the AI understand your case better.
              </p>
              {errors.description && (
                <p className="mt-1 text-sm text-red-400">
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ color: "var(--muted-foreground)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "text-sm font-medium transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
                style={{
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? "Creating..." : "Create Case"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
