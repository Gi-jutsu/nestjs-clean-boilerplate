import { InjectionToken, Provider } from '@nestjs/common';

type Branded<T, Brand> = T & { __brand: Brand };

export type BrandedInjectionToken<T> = Branded<symbol, T>;
type ClassConstructor<T = any> = new (...args: any[]) => T;

type ExpectedTokensArray<C extends ClassConstructor> =
  ConstructorParameters<C> extends [...infer Params]
    ? { [K in keyof Params]: Pick<BrandedInjectionToken<Params[K]>, '__brand'> }
    : [];

/**
 * Ensures that a NestJS provider is created with the correct injection tokens
 * based on the constructor parameters of the provided class.
 *
 * @example
 * // Step 1: Define the interface and token
 * export interface AccountRepository {
 *   isEmailTaken(email: string): Promise<boolean>;
 *   findByEmail(email: string): Promise<Account | null>;
 *   save(account: Account): Promise<void>;
 * }
 *
 * export const AccountRepositoryToken = Symbol('AccountRepository') as BrandedInjectionToken<AccountRepository>;
 *
 * // Step 2: Use with a class that depends on that token
 * export class ForgotPasswordUseCase {
 *   constructor(private readonly allAccounts: AccountRepository) {}
 * }
 *
 * // Step 3: Create a provider
 * createNestProvider(ForgotPasswordUseCase, [AccountRepositoryToken]);
 *
 * // ✅ Type-safe — if the token doesn't match the expected constructor type,
 * // you'll get a TypeScript error.
 */
export function createNestProvider<
  C extends ClassConstructor,
  Tokens extends ExpectedTokensArray<C>,
>(useClass: C, inject: Tokens, provide?: InjectionToken): Provider {
  return {
    provide: provide ?? useClass,
    useFactory: (...args: any[]) => new useClass(...args),
    inject: inject as any,
  };
}
