import { registerDecorator, ValidationOptions } from 'class-validator';
import { ehDataValida } from './fuso';

/** Valida uma data real no formato YYYY-MM-DD (rejeita 2026-02-31 e 2026-13-01). */
export function IsDataYmd(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isDataYmd',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} deve ser uma data válida no formato YYYY-MM-DD.`,
        ...options,
      },
      validator: {
        validate: (value: unknown) => ehDataValida(value),
      },
    });
  };
}
