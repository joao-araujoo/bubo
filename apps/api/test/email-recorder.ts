import { type EmailSender, type ReadingReturnMessage } from '../src/services/email';
import { type EmailCode, type EmailLink, type EmailReader } from '../src/services/email-templates';

/** A sender that can deliver nothing and records nothing: the harness default. */
export function silentEmailSender(): EmailSender {
  return {
    canDeliver: false,
    sendPasswordReset: async () => undefined,
    sendVerification: async () => undefined,
    sendPasswordChanged: async () => undefined,
    sendLoginCode: async () => undefined,
    sendPasswordResetCode: async () => undefined,
    sendAccountDeleted: async () => undefined,
    sendReadingReturn: async () => undefined,
    sendTest: async () => undefined,
  };
}

/**
 * A configured sender that records every message instead of talking to Resend. Tests read the
 * codes from here exactly like a reader would from their inbox. `fail` makes a category throw.
 */
export function createEmailRecorder() {
  const loginCodes: EmailCode[] = [];
  const resetCodes: EmailCode[] = [];
  const resets: EmailLink[] = [];
  const verifications: EmailLink[] = [];
  const changed: EmailReader[] = [];
  const deleted: EmailReader[] = [];
  const returns: ReadingReturnMessage[] = [];
  const fail = new Set<string>();
  const guard = (category: string) => {
    if (fail.has(category)) throw new Error('provider down');
  };
  let receipts = 0;
  const sender: EmailSender = {
    canDeliver: true,
    async sendPasswordReset(message) {
      guard('reset');
      resets.push(message);
    },
    async sendVerification(message) {
      guard('verification');
      verifications.push(message);
    },
    async sendPasswordChanged(message) {
      guard('changed');
      changed.push(message);
    },
    async sendLoginCode(message) {
      guard('login');
      loginCodes.push(message);
    },
    async sendPasswordResetCode(message) {
      guard('reset-code');
      resetCodes.push(message);
    },
    async sendAccountDeleted(message) {
      guard('deleted');
      deleted.push(message);
    },
    async sendReadingReturn(message) {
      guard('return');
      returns.push(message);
      receipts += 1;
      return { id: `email_${receipts}`, provider: 'resend' };
    },
    sendTest: async () => undefined,
  };
  return {
    sender,
    loginCodes,
    resetCodes,
    resets,
    verifications,
    changed,
    deleted,
    returns,
    fail,
    /** Latest code e-mailed to `to`, if any. */
    lastLoginCode: (to: string) => loginCodes.filter((m) => m.to === to).at(-1)?.code,
    lastResetCode: (to: string) => resetCodes.filter((m) => m.to === to).at(-1)?.code,
  };
}
