import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const PUBLIC_METADATA = Symbol.for('public');

export function Public(): CustomDecorator<typeof PUBLIC_METADATA> {
  return SetMetadata(PUBLIC_METADATA, true);
}
