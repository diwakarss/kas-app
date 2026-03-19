/**
 * Spec Initializer
 *
 * Orchestrates spec loading, validation, schema generation, and seeding.
 * This module lives in engines/ and can be called from App.tsx or providers.
 *
 * Architecture: This keeps engine logic out of core/context/ to respect
 * the block boundary rule (runtime-core cannot import from engines).
 */

import { Platform } from 'react-native';
import type { KASAppSpec } from '../core/types/spec';
import type { DatabaseAdapter } from '../data/database-adapter';
import { loadSpec } from './spec-loader';
import { generateDDL } from './schema-engine';
import { CrudService } from '../data/crud-service';
import { ACTIVE_SPEC } from '../config/spec-config';

export interface InitializedSpec {
  spec: KASAppSpec | null;
  db: DatabaseAdapter | null;
  crud: CrudService | null;
  loading: boolean;
  error: string | null;
}

/**
 * Load the active spec JSON based on ACTIVE_SPEC config.
 */
function loadActiveSpec(): any {
  switch (ACTIVE_SPEC) {
    case 'shopkeeper':
      return require('../../assets/shopkeeper-spec.json');
    case 'tutor':
    default:
      return require('../../assets/tutor-spec.json');
  }
}

/**
 * Initialize spec, database schema, and seed data.
 * Returns the full context value ready for SpecContext.
 */
export function initializeSpec(adapter: DatabaseAdapter): InitializedSpec {
  console.log('[SpecInitializer] Starting initialization...');

  // 1. Load and validate spec
  const specJson = loadActiveSpec();
  const result = loadSpec(specJson);

  if (!result.success) {
    console.log('[SpecInitializer] Spec validation failed:', result.errors);
    return {
      spec: null,
      db: null,
      crud: null,
      loading: false,
      error: `Spec validation failed:\n${result.errors.join('\n')}`,
    };
  }

  const validSpec = result.spec;
  console.log('[SpecInitializer] Spec loaded:', validSpec.meta.name);

  // 2. Initialize schema (idempotent — IF NOT EXISTS)
  const ddlStatements = generateDDL(validSpec);
  const isWeb = Platform.OS === 'web';
  console.log('[SpecInitializer] DDL statements:', ddlStatements.length, isWeb ? '(web — skipping FTS5)' : '');
  for (let i = 0; i < ddlStatements.length; i++) {
    // sql.js doesn't include FTS5 — skip virtual tables and their triggers on web
    if (isWeb && (ddlStatements[i].includes('fts5') || ddlStatements[i].includes('_fts'))) {
      continue;
    }
    try {
      adapter.execRaw(ddlStatements[i]);
    } catch (ddlErr: any) {
      console.log(`[SpecInitializer] DDL[${i}] failed:`, ddlErr.message);
    }
  }
  console.log('[SpecInitializer] Schema initialized');

  // 3. Create CRUD service
  const crudService = new CrudService(adapter, validSpec);

  // 4. Seed data if empty (first entity table)
  const firstEntity = validSpec.entities[0];
  const firstTable = firstEntity.name.toLowerCase();
  const count = adapter.getFirst<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${firstTable}`
  );
  console.log(`[SpecInitializer] ${firstTable} count:`, count?.cnt);
  if (count && count.cnt === 0) {
    if (ACTIVE_SPEC === 'tutor') {
      seedTutorData(crudService);
    } else if (ACTIVE_SPEC === 'shopkeeper') {
      seedShopkeeperData(crudService);
    }
    console.log('[SpecInitializer] Seed data inserted');
  }

  console.log('[SpecInitializer] Initialization complete');
  return {
    spec: validSpec,
    db: adapter,
    crud: crudService,
    loading: false,
    error: null,
  };
}

// ──────────────────────────────────────────
// Seed functions
// ──────────────────────────────────────────

function seedTutorData(crud: CrudService): void {
  const priyaId = crud.create('Student', {
    name: 'Priya Sharma',
    hourly_fee: 500,
    phone: '9876543210',
    email: 'priya@example.com',
    grade: 'Grade 8',
  });

  const rahulId = crud.create('Student', {
    name: 'Rahul Iyer',
    hourly_fee: 400,
    phone: '9876543211',
    email: 'rahul@example.com',
    grade: 'Grade 5',
  });

  const ananyaId = crud.create('Student', {
    name: 'Ananya Nair',
    hourly_fee: 600,
    phone: '9876543212',
    email: 'ananya@example.com',
    grade: 'Grade 10',
  });

  const today = new Date().toISOString().split('T')[0];

  // Today's scheduled classes
  crud.create('Class', { student_id: priyaId, datetime: `${today}T10:00:00`, duration: 60, topic: 'Scales & Ragas', status: 'scheduled' });
  crud.create('Class', { student_id: rahulId, datetime: `${today}T14:00:00`, duration: 45, topic: 'Basics - Sa Re Ga', status: 'scheduled' });
  crud.create('Class', { student_id: ananyaId, datetime: `${today}T17:00:00`, duration: 90, topic: 'Music Theory', status: 'scheduled' });

  // Past completed classes
  for (let i = 1; i <= 10; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i * 3);
    crud.create('Class', { student_id: priyaId, datetime: pastDate.toISOString(), duration: 60, topic: 'Practice Session', status: 'completed' });
  }
  for (let i = 1; i <= 5; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i * 4);
    crud.create('Class', { student_id: rahulId, datetime: pastDate.toISOString(), duration: 45, topic: 'Basics', status: 'completed' });
  }
  for (let i = 1; i <= 8; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i * 2);
    crud.create('Class', { student_id: ananyaId, datetime: pastDate.toISOString(), duration: 90, topic: 'Theory & Practice', status: 'completed' });
  }

  // Future scheduled classes
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 2);

  crud.create('Class', { student_id: priyaId, datetime: `${tomorrow.toISOString().split('T')[0]}T10:00:00`, duration: 60, topic: 'Scales Review', status: 'scheduled' });
  crud.create('Class', { student_id: priyaId, datetime: `${dayAfter.toISOString().split('T')[0]}T10:00:00`, duration: 60, topic: 'New Raga Introduction', status: 'scheduled' });
  crud.create('Class', { student_id: rahulId, datetime: `${tomorrow.toISOString().split('T')[0]}T14:00:00`, duration: 45, topic: 'Notation Practice', status: 'scheduled' });

  // Payments
  crud.create('Payment', { student_id: priyaId, amount: 5000, date: today, method: 'Cash' });
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  crud.create('Payment', { student_id: rahulId, amount: 1000, date: twoWeeksAgo.toISOString().split('T')[0], method: 'UPI' });
  crud.create('Payment', { student_id: ananyaId, amount: 4800, date: today, method: 'Bank Transfer' });

  // Notes
  crud.create('Note', { student_id: priyaId, content: 'Left hand weak on transitions between ragas. Focus on finger independence exercises.', date: today });
  crud.create('Note', { student_id: rahulId, content: 'Needs more practice on reading notation. Recommend daily 15min sight-reading.', date: today });
}

function seedShopkeeperData(crud: CrudService): void {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Customers
  const meenaId = crud.create('Customer', { name: 'Meena Devi', phone: '9876543210', address: '12 Nehru Street' });
  const sureshId = crud.create('Customer', { name: 'Suresh Kumar', phone: '9876543211', address: '45 Gandhi Road' });
  const priyaId = crud.create('Customer', { name: 'Priya Patel', phone: '9876543212' });

  // Products
  crud.create('Product', { name: 'Rice (5kg)', price: 250, category: 'grocery', stock_quantity: 50 });
  crud.create('Product', { name: 'Toor Dal (1kg)', price: 120, category: 'grocery', stock_quantity: 30 });
  crud.create('Product', { name: 'Amul Milk (1L)', price: 60, category: 'dairy', stock_quantity: 20 });
  crud.create('Product', { name: 'Cooking Oil (1L)', price: 180, category: 'grocery', stock_quantity: 15 });
  crud.create('Product', { name: 'Biscuits', price: 30, category: 'snacks', stock_quantity: 40 });

  // Yesterday's transactions (for anchor screen)
  crud.create('Transaction', { customer_id: meenaId, date: yesterdayStr, amount: 450, items_description: 'Rice 5kg, Dal 1kg', payment_method: 'cash' });
  crud.create('Transaction', { customer_id: sureshId, date: yesterdayStr, amount: 280, items_description: 'Oil, Biscuits, Milk', payment_method: 'upi' });
  crud.create('Transaction', { customer_id: priyaId, date: yesterdayStr, amount: 600, items_description: 'Monthly groceries', payment_method: 'credit' });

  // Older transactions
  for (let i = 2; i <= 10; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i);
    crud.create('Transaction', {
      customer_id: meenaId,
      date: pastDate.toISOString().split('T')[0],
      amount: 100 + i * 30,
      items_description: 'Daily essentials',
      payment_method: i % 2 === 0 ? 'cash' : 'upi',
    });
  }

  // Credits
  crud.create('Credit', { customer_id: priyaId, amount: 600, date: yesterdayStr, reason: 'Monthly groceries - will pay next week' });
  crud.create('Credit', { customer_id: sureshId, amount: 200, date: today, reason: 'Short on cash, pending UPI transfer' });
}
