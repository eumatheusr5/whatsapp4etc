import { ArgumentMetadata, HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ZodTypeAny } from 'zod';
import { AppException, ErrCodes } from './errors';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(
        ErrCodes.VALIDATION,
        'Payload inválido',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { issues: result.error.flatten() },
      );
    }
    return result.data;
  }
}
