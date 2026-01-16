import z from 'zod';

export const ForgotPasswordChangeType = z.object({
  email: z.string().email(),
  token: z.string().min(6).max(6),
  password: z.string().min(6),
});

export class ForgotPasswordChangeDto {
  token: string;
  email: string;
  password: string;

  constructor(data: z.infer<typeof ForgotPasswordChangeType>) {
    ForgotPasswordChangeType.parse(data);
    Object.assign(this, data);
  }
}
export const ChangePasswordType = z.object({
  old_password: z.string(),
  new_password: z.string().min(6),
});
export class ChangePasswordDto {
  old_password: string;
  new_password: string;

  constructor(data: z.infer<typeof ChangePasswordType>) {
    ChangePasswordType.parse(data);
    Object.assign(this, data);
  }
}
