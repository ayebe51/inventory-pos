import { BadRequestException } from '@nestjs/common';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function assertOptionalUuid(
  value: string | undefined | null,
  field: string,
): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (!isUuid(value)) {
    throw new BadRequestException(`${field} must be a valid UUID`);
  }
  return value;
}
