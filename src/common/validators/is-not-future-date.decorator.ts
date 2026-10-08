import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Data que não pode estar no futuro, avaliada a cada requisição.
 * (`@MaxDate(new Date())` congela o limite no momento em que o servidor sobe.)
 */
export function IsNotFutureDate(options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} não pode estar no futuro`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          value instanceof Date &&
          !Number.isNaN(value.getTime()) &&
          value.getTime() <= Date.now(),
      },
    });
  };
}
