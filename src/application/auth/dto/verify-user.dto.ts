import z from "zod";

export const VerifyOtpType = z.object({
  phone: z
    .string()
    .regex(/^\+\d{1,4}\s\d{4,14}$/, {
      message:
        "Phone number must include a valid country code followed by a space and digits only (e.g., +234 1234567890)",
    })
    .optional(),
  token: z.string().min(6).max(6),
  email: z.email().optional(),
});

export class VerifyOtpDto {
  token: string;
  email: string;
  phone?: string;
  constructor(data: z.infer<typeof VerifyOtpType>) {
    VerifyOtpType.parse(data);
    Object.assign(this, data);
  }
}

export const ResendOtpType = z.object({
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^\+\d{1,4}\s\d{4,14}$/, {
      message:
        "Phone number must include a valid country code followed by a space and digits only (e.g., +234 1234567890)",
    })
    .optional(),
});

export class ResendOtpDto {
  email?: string;
  phone?: string;

  constructor(data: z.infer<typeof ResendOtpType>) {
    ResendOtpType.parse(data);
    Object.assign(this, data);
  }
}
