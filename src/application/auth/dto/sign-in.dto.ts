import { RoleNameType } from '@/interfaces/types/users';
import z from 'zod';

const phoneWithCountryCode = z.string().regex(/^\+\d{1,4}\s\d{4,14}$/, {
  message:
    'Phone number must include a valid country code followed by a space and digits only (e.g., +234 1234567890)',
});

export const SignInType = z.object({
  email: z.string().email().optional(),
  phone: phoneWithCountryCode.optional(),
  password: z.string().min(1),
  role: z.string().optional().default(RoleNameType.Host),
  new_role: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((val) => val === true || val === 'true')
    .default(false),
});

export class SignInDto {
  email?: string;
  phone?: string;
  password: string;
  role?: RoleNameType;
  new_role?: boolean;

  constructor(data: z.infer<typeof SignInType>) {
    SignInType.parse(data);
    Object.assign(this, data);
  }
}
