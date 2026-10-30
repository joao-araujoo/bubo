/**
 * Whether the app may show the boot screen for the Better Auth session (pure, tested).
 *
 * Better Auth marks a signed-out session as `isPending` again on every refetch: after a sign-in
 * that only starts the e-mailed code, after sending the code, after a failed sign-up. Showing the
 * boot screen then unmounts the navigator and drops the reader back on the welcome screen before
 * the code screen opens. Only the very first resolution may block; later refetches keep the
 * current screens while they run.
 */
export function sessionIsBooting(input: { pending: boolean; resolvedBefore: boolean }): boolean {
  return input.pending && !input.resolvedBefore;
}
