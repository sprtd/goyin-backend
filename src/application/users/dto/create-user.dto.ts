import { createInsertSchema } from 'drizzle-zod';
import * as schema from '@/infrastructure/persistence/index';
import { z } from 'zod';

export const userSchema = createInsertSchema(schema.users);
export class CreateUserDto {
  // Define properties based on the schema
  // ...existing code...

  constructor(data: z.infer<typeof userSchema>) {
    // Validate and assign properties
    userSchema.parse(data);
    Object.assign(this, data);
  }
}

export type CreateUserType = typeof schema.users.$inferInsert;
