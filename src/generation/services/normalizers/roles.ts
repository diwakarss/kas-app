/**
 * Entity role classification.
 *
 * Pure classification — no mutation. Downstream stages use role to decide
 * status taxonomies, money close-loop candidates, anchor swap targets, etc.
 */

import type { Entity } from '../../../core/types/spec';
import { METADATA_DATE_PATTERNS } from './shared';

/**
 *  - person:    the business's customers/subjects (Client, Patient, Student)
 *  - container: groupings (Couple, Family, Company)
 *  - activity:  day-to-day unit of work (Fitting, Showing, Appointment)
 *  - document:  long-lived records (Matter, Order, Contract, Prescription)
 *  - payment:   money-in events (Payment, Invoice, Receipt, Bill, Charge)
 *  - account:   financial aggregations (RetainerAccount, Ledger, Wallet)
 *  - record:    fallback
 */
export type EntityRole = 'person' | 'container' | 'activity' | 'document' | 'payment' | 'account' | 'record';

const PERSON_LIKE_NAMES = new Set([
  'client', 'customer', 'patient', 'member', 'student', 'child', 'kid',
  'pet', 'dog', 'cat', 'animal', 'owner', 'parent', 'employee', 'staff',
  'instructor', 'teacher', 'trainer', 'therapist', 'doctor',
]);

const CONTAINER_NAMES = new Set([
  'couple', 'family', 'household', 'account', 'company', 'organization',
  'team', 'group', 'profile', 'case', 'project',
]);

const PAYMENT_NAMES = new Set([
  'payment', 'invoice', 'receipt', 'bill', 'charge', 'transaction', 'refund',
]);

const ACCOUNT_NAMES = new Set([
  'account', 'retaineraccount', 'ledger', 'balance', 'wallet', 'budget',
]);

const DOCUMENT_NAMES = new Set([
  'matter', 'order', 'contract', 'agreement', 'document', 'prescription',
  'policy', 'claim', 'ticket', 'request', 'quote', 'estimate', 'proposal',
]);

const ACTIVITY_DATE_FIELDS = new Set([
  'scheduled_at', 'scheduled_for', 'date', 'start_time', 'appointment_at',
  'visit_at', 'session_at', 'tour_date',
]);

export function isPersonLikeEntity(entity: Entity): boolean {
  if (PERSON_LIKE_NAMES.has(entity.name.toLowerCase())) return true;
  const fieldNames = new Set(entity.fields.map(f => f.name.toLowerCase()));
  return fieldNames.has('name') && (fieldNames.has('email') || fieldNames.has('phone'));
}

/**
 * Container anchors (Couple, Family, Company) have one or two far-future
 * dates that pass the scheduling heuristic but don't generate day-to-day
 * activity. Anchor swap logic uses this to flip to a child entity.
 */
export function isContainerEntity(entity: Entity): boolean {
  return CONTAINER_NAMES.has(entity.name.toLowerCase());
}

export function hasActivityDateField(entity: Entity): boolean {
  for (const f of entity.fields) {
    if (ACTIVITY_DATE_FIELDS.has(f.name.toLowerCase())) return true;
    if ((f.type === 'date' || f.type === 'datetime' || f.type === 'time') &&
        !METADATA_DATE_PATTERNS.test(f.name)) {
      return true;
    }
  }
  return false;
}

export function hasMoneyFields(entity: Entity): boolean {
  const fieldNames = new Set(entity.fields.map(f => f.name.toLowerCase()));
  return fieldNames.has('amount') || fieldNames.has('amount_paid') ||
         fieldNames.has('paid_amount') || fieldNames.has('total');
}

/** Classify an entity by role. Pure function — no mutation. */
export function classifyEntityRole(entity: Entity): EntityRole {
  const lower = entity.name.toLowerCase();
  if (PAYMENT_NAMES.has(lower)) return 'payment';
  if (ACCOUNT_NAMES.has(lower)) return 'account';
  if (DOCUMENT_NAMES.has(lower)) return 'document';
  if (isPersonLikeEntity(entity)) return 'person';
  if (isContainerEntity(entity)) return 'container';
  if (hasMoneyFields(entity) && entity.fields.some(f => f.type === 'currency')) {
    return 'payment';
  }
  if (hasActivityDateField(entity)) return 'activity';
  return 'record';
}
