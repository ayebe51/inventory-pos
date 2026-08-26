import { Transform } from 'class-transformer';

export function ToBooleanQuery(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return value;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
}
