/**
 * Money close-loop normalization.
 *
 * Normalizes computed_fields shape and injects `amount_paid` + `balance_due`
 * on parent entities that own a currency total and have a payment-role
 * child. Paired with `injectBalanceDueStats` in story-events.ts to surface
 * the balance on the Story screen.
 */

import type { Entity, Field } from '../../../core/types/spec';
import { classifyEntityRole } from './roles';

/** Fills in defaults for missing computed field props. */
export function normalizeComputedFields(
  computedFields: Record<string, any[]> | undefined
): Record<string, any[]> {
  if (!computedFields) return {};

  const normalized: Record<string, any[]> = {};
  for (const [entityName, fields] of Object.entries(computedFields)) {
    normalized[entityName] = (fields || []).map(field => ({
      name: field.name || 'unnamed_computed',
      display_name: field.display_name || field.name || 'Unnamed',
      type: field.type || 'count',
      source_entity: field.source_entity,
      relationship: field.relationship,
      source_field: field.source_field,
      formula: field.formula,
      date_field: field.date_field,
      filter: field.filter,
      format: field.format,
      prefix: field.prefix,
      suffix: field.suffix,
    }));
  }
  return normalized;
}

const EXISTING_BALANCE_FIELD_NAMES = new Set([
  'balance_due', 'balance', 'amount_due', 'outstanding', 'remaining', 'amount_paid',
]);

/** Pick the parent currency field that represents the billable total. */
function findTotalField(entity: Entity): Field | null {
  const byName = ['total_cost', 'total', 'amount', 'fee', 'price', 'cost', 'rate'];
  for (const n of byName) {
    const f = entity.fields.find(x => x.name === n && x.type === 'currency');
    if (f) return f;
  }
  return entity.fields.find(f => f.type === 'currency') ?? null;
}

/** Pick the child payment amount field (what each payment contributes). */
function findPaymentAmountField(entity: Entity): Field | null {
  const byName = ['amount', 'amount_paid', 'total', 'payment_amount'];
  for (const n of byName) {
    const f = entity.fields.find(x => x.name === n && x.type === 'currency');
    if (f) return f;
  }
  return entity.fields.find(f => f.type === 'currency') ?? null;
}

/**
 * For each parent entity with a billable total and a payment-role child, inject
 *   amount_paid = sum(Payment.amount WHERE status='Paid')
 *   balance_due = total - amount_paid
 *
 * Skipped when the parent already owns a balance-like field or computed field.
 * Respects "Paid" status only when the payment entity has a status choice
 * containing "Paid" (guaranteed by the role-aware status taxonomy).
 */
export function injectBalanceDue(
  entities: Entity[],
  computedFields: Record<string, any[]>
): Record<string, any[]> {
  const result: Record<string, any[]> = { ...computedFields };

  for (const parent of entities) {
    const role = classifyEntityRole(parent);
    if (role === 'payment' || role === 'account') continue;

    const parentField = findTotalField(parent);
    if (!parentField) continue;

    const payChild = entities.find(
      c => classifyEntityRole(c) === 'payment' &&
           c.relationships.some(r => r.type === 'belongs_to' && r.target === parent.name)
    );
    if (!payChild) continue;

    const payRel = payChild.relationships.find(r => r.type === 'belongs_to' && r.target === parent.name)!;
    const payAmountField = findPaymentAmountField(payChild);
    if (!payAmountField) continue;

    const parentHasBalanceField = parent.fields.some(
      f => EXISTING_BALANCE_FIELD_NAMES.has(f.name.toLowerCase())
    );
    const existing = new Set((result[parent.name] || []).map((c: any) => c.name));
    const parentHasBalanceComputed =
      existing.has('balance_due') || existing.has('amount_paid');

    if (parentHasBalanceField || parentHasBalanceComputed) continue;

    const payStatus = payChild.fields.find(f => f.name === 'status' && f.type === 'choice');
    const hasPaidOption = payStatus?.options?.some(o => o.toLowerCase() === 'paid') ?? false;

    const amountPaid: any = {
      name: 'amount_paid',
      display_name: 'Amount Paid',
      type: 'sum',
      source_entity: payChild.name,
      source_field: payAmountField.name,
      relationship: payRel.foreign_key,
      prefix: '$',
    };
    if (hasPaidOption) {
      amountPaid.filter = { field: 'status', condition: 'equals', value: 'Paid' };
    }

    const balanceDue: any = {
      name: 'balance_due',
      display_name: 'Balance Due',
      type: 'formula',
      formula: `{${parentField.name}} - {amount_paid}`,
      prefix: '$',
    };

    result[parent.name] = [...(result[parent.name] || []), amountPaid, balanceDue];
    console.log(
      `[normalizeSpec] Injected balance_due on '${parent.name}': ${parentField.name} - sum(${payChild.name}.${payAmountField.name}${hasPaidOption ? ' WHERE status=Paid' : ''})`
    );
  }

  return result;
}
