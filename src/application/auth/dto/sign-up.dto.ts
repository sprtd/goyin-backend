import { RoleNameType } from '@/interfaces/types/users';
import z from 'zod';

const phoneWithCountryCode = z.string().regex(/^\+\d{1,4}\s\d{4,14}$/, {
  message:
    'Phone number must include a valid country code followed by a space and digits only (e.g., +234 1234567890)',
});

export enum AllowedRoles {
  Host = 'host',
  Guest = 'guest',
  Friend = 'friend',
}

export const CreateUserType = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: phoneWithCountryCode.optional(),
  password: z.string().min(8),
  role: z.nativeEnum(AllowedRoles).default(AllowedRoles.Host),
  verify_via: z.enum(['email', 'phone']).default('email'),
});

export class CreateUserDto {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role: RoleNameType;
  verify_via: 'email' | 'phone';

  constructor(data: z.infer<typeof CreateUserType>) {
    CreateUserType.parse(data);
    Object.assign(this, data);
  }
}

// import { createInsertSchema } from 'drizzle-zod';
// import * as schema from '@/infrastructure/persistence/index';
// import { z } from 'zod';

// export const userSchema = createInsertSchema(schema.users);
// export class CreateUserDto {
//   // Define properties based on the schema
//   // ...existing code...
//   role: string;

//   constructor(data: z.infer<typeof userSchema>) {
//     // Validate and assign properties
//     userSchema.parse(data);
//     Object.assign(this, data);
//   }
// }

// export type CreateUserType = typeof schema.users.$inferInsert;
