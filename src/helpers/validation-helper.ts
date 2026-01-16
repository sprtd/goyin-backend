import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export function validateDto(dtoSchema: z.ZodSchema<any>, body: any) {
  try {
    const result = dtoSchema.parse(body);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('🚀 ~ validateDto ~ error:', error.issues);
      throw new BadRequestException({
        statusCode: 400,
        message: 'Validation error',
        error: 'BadRequestException',
        timestamp: Date.now(),
        version: 'v2',
        path: '/validateDto',
        errors: error.issues,
        data: error.issues,
      });
    }
    throw error;
  }
}
