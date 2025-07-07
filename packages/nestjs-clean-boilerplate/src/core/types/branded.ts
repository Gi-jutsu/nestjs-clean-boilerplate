/**
 * Creates a branded type by combining `T` with a unique `Brand`.
 * This helps TypeScript distinguish between types that have the same shape but different meanings.
 *
 * Example:
 * ```ts
 * type UserId = Branded<number, "UserId">;
 * type OrderId = Branded<number, "OrderId">;
 *
 * const userId: UserId = 123 as UserId;
 * const orderId: OrderId = 456 as OrderId;
 *
 * // userId = orderId; // Error: Type '"OrderId"' is not assignable to type '"UserId"'
 * ```
 *
 * For more info, see: http://egghead.io/blog/using-branded-types-in-typescript
 */
export type Branded<T, Brand> = T & { __brand: Brand };
