// ABOUTME: Zod validation schemas for case forms
// ABOUTME: Matches backend validation rules

import { z } from "zod";

export const caseCreateSchema = z.object({
  name: z
    .string()
    .min(3, "Case name must be at least 3 characters")
    .max(100, "Case name must be less than 100 characters"),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional()
    .or(z.literal("")),
});

export type CaseCreateFormData = z.infer<typeof caseCreateSchema>;
