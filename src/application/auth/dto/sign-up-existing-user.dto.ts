import { z } from 'zod';

enum AllowedRoles {
  Host = 'host',
  Guest = 'guest',
  Friend = 'friend',
}

export const CreateUserTypeExistingUser = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  role: z.nativeEnum(AllowedRoles).default(AllowedRoles.Host),
  password: z.string().min(8).optional(),
});

export class CreateUserExistingUserDto {
  email?: string;
  phone?: string;
  password?: string;

  constructor(data: z.infer<typeof CreateUserTypeExistingUser>) {
    CreateUserTypeExistingUser.parse(data);
    Object.assign(this, data);
  }
}
