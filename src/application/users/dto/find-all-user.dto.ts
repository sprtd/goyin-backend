import { z } from 'zod';

// Define the schema for events and sub_events
export const findAllUserSchemaBodyType = z
  .object({
    events: z.boolean().optional(),
    sub_events: z.boolean().optional(),
  })
  .strict();

export class FindAllUsersDto {
  events?: boolean;
  sub_events?: boolean;

  constructor(data: z.infer<typeof findAllUserSchemaBodyType>) {
    // Validate and assign properties
    findAllUserSchemaBodyType.parse(data);
    Object.assign(this, data);
  }
}

export type ValidateUserType = z.infer<typeof findAllUserSchemaBodyType>;
