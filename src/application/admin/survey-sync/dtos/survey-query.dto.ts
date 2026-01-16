import { z } from "zod";

export const SurveyQuerySchema = z.object({
  type: z.enum(["user", "driver"]).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type SurveyQueryDto = z.infer<typeof SurveyQuerySchema>;
