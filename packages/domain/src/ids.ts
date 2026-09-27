declare const brand: unique symbol;

/** Nominal typing for ids so a BookId can never be passed where a UserId is expected. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type BookId = Brand<string, 'BookId'>;
export type ReadingCycleId = Brand<string, 'ReadingCycleId'>;
export type RecallCardId = Brand<string, 'RecallCardId'>;
export type ClubId = Brand<string, 'ClubId'>;
