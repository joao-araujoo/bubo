import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth';
import { shelfEntries } from './reader';

/** Focused reading sessions (Task 03). Mirrors migrations/0004_reading_sessions.sql. */
export const readingSessions = pgTable(
  'reading_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    shelfEntryId: text('shelf_entry_id')
      .notNull()
      .references(() => shelfEntries.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    focusedSeconds: integer('focused_seconds').notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    reflection: text('reflection'),
    /** Nullable for historical sessions. V1 values are validated by the API contracts. */
    recallExercise: jsonb('recall_exercise').$type<{
      idea: string;
      detail: string;
      connection: string;
    }>(),
    recallAssessment: jsonb('recall_assessment').$type<{
      version: 'bubo-recall-v1';
      passed: boolean;
      score: number;
      kind: 'writing_checklist';
      factualVerification: 'unavailable';
      checks: {
        key: 'idea' | 'detail' | 'connection' | 'originality';
        passed: boolean;
        message: string;
      }[];
      feedback: string;
    }>(),
    /** Reader's local calendar day (YYYY-MM-DD). */
    localDate: date('local_date', { mode: 'string' }).notNull(),
    xpEarned: integer('xp_earned').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('reading_sessions_user_date_idx').on(table.userId, table.localDate),
    index('reading_sessions_entry_idx').on(table.shelfEntryId),
    check(
      'reading_sessions_recall_pair_check',
      sql`((
        (${table.recallExercise} IS NULL AND ${table.recallAssessment} IS NULL)
        OR (
          ${table.recallExercise} IS NOT NULL AND ${table.recallAssessment} IS NOT NULL
          AND jsonb_typeof(${table.recallExercise}) = 'object'
          AND jsonb_typeof(${table.recallAssessment}) = 'object'
          AND ${table.recallExercise} ?& ARRAY['idea', 'detail', 'connection']
          AND ${table.recallAssessment} ?& ARRAY['version', 'passed', 'score', 'kind', 'factualVerification', 'checks', 'feedback']
          AND jsonb_typeof(${table.recallExercise}->'idea') = 'string'
          AND jsonb_typeof(${table.recallExercise}->'detail') = 'string'
          AND jsonb_typeof(${table.recallExercise}->'connection') = 'string'
          AND jsonb_typeof(${table.recallAssessment}->'passed') = 'boolean'
          AND jsonb_typeof(${table.recallAssessment}->'score') = 'number'
          AND jsonb_typeof(${table.recallAssessment}->'checks') = 'array'
          AND jsonb_typeof(${table.recallAssessment}->'feedback') = 'string'
          AND ${table.recallAssessment}->>'version' = 'bubo-recall-v1'
          AND ${table.recallAssessment}->>'passed' = 'true'
          AND ${table.recallAssessment}->>'score' = '100'
          AND ${table.recallAssessment}->>'kind' = 'writing_checklist'
          AND ${table.recallAssessment}->>'factualVerification' = 'unavailable'
        )
      )) IS TRUE`,
    ),
  ],
);
