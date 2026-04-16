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
      return require('../../assets/templates/shopkeeper.json');
    case 'restaurant':
      return require('../../assets/templates/restaurant.json');
    case 'doctor':
      return require('../../assets/templates/doctor.json');
    case 'tutor':
    default:
      return require('../../assets/templates/tutor.json');
  }
}

/**
 * Initialize spec from provided JSON.
 * Used for preview mode where spec is fetched from API.
 * Does NOT seed data — sample data comes from API response.
 */
export function initializeSpecFromJson(
  adapter: DatabaseAdapter,
  specJson: unknown
): InitializedSpec {
  console.log('[SpecInitializer] Initializing from provided JSON...');

  // 1. Validate spec
  const result = loadSpec(specJson);
  if (!result.success) {
    console.error('[SpecInitializer] Spec validation failed:', result.errors);
    return {
      spec: null,
      db: null,
      crud: null,
      loading: false,
      error: `Spec validation failed:\n${result.errors.join('\n')}`,
    };
  }

  const validSpec = result.spec;
  console.log('[SpecInitializer] Spec validated:', validSpec.meta.name);

  // 2. Initialize schema (idempotent — IF NOT EXISTS)
  const ddlStatements = generateDDL(validSpec);
  const isWeb = Platform.OS === 'web';
  console.log('[SpecInitializer] DDL statements:', ddlStatements.length);
  for (let i = 0; i < ddlStatements.length; i++) {
    // sql.js doesn't include FTS5 — skip virtual tables and their triggers on web
    if (isWeb && (ddlStatements[i].includes('fts5') || ddlStatements[i].includes('_fts'))) {
      continue;
    }
    try {
      adapter.execRaw(ddlStatements[i]);
    } catch (ddlErr: any) {
      console.warn(`[SpecInitializer] DDL[${i}] failed:`, ddlErr.message);
    }
  }
  console.log('[SpecInitializer] Schema initialized');

  // 3. Create CRUD service (no seeding — caller handles sample data)
  const crudService = new CrudService(adapter, validSpec);

  console.log('[SpecInitializer] Initialization complete (preview mode)');
  return {
    spec: validSpec,
    db: adapter,
    crud: crudService,
    loading: false,
    error: null,
  };
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
    try {
      if (ACTIVE_SPEC === 'tutor') {
        seedTutorData(crudService);
      } else if (ACTIVE_SPEC === 'shopkeeper') {
        seedShopkeeperData(crudService);
      } else if (ACTIVE_SPEC === 'restaurant') {
        seedRestaurantData(crudService);
      } else if (ACTIVE_SPEC === 'doctor') {
        seedDoctorData(crudService);
      }
      console.log('[SpecInitializer] Seed data inserted');
    } catch (seedErr: any) {
      console.log('[SpecInitializer] Seed error:', seedErr?.message || seedErr);
      throw seedErr;
    }
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

function seedRestaurantData(crud: CrudService): void {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Customers
  const rahulId = crud.create('Customer', { name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@example.com' });
  const priyaId = crud.create('Customer', { name: 'Priya Patel', phone: '9876543211', email: 'priya@example.com' });
  const vikramId = crud.create('Customer', { name: 'Vikram Singh', phone: '9876543212' });
  const ananyaId = crud.create('Customer', { name: 'Ananya Reddy', phone: '9876543213', email: 'ananya@example.com' });

  // Tables
  const table1 = crud.create('Table', { table_number: 'T1', capacity: 2, status: 'available' });
  const table2 = crud.create('Table', { table_number: 'T2', capacity: 4, status: 'available' });
  const table3 = crud.create('Table', { table_number: 'T3', capacity: 4, status: 'occupied' });
  const table4 = crud.create('Table', { table_number: 'T4', capacity: 6, status: 'reserved' });
  const table5 = crud.create('Table', { table_number: 'T5', capacity: 8, status: 'available' });

  // Menu Items
  crud.create('MenuItem', { name: 'Paneer Tikka', description: 'Marinated cottage cheese grilled to perfection', price: 280, category: 'appetizer' });
  crud.create('MenuItem', { name: 'Samosa', description: 'Crispy pastry with spiced potato filling', price: 80, category: 'appetizer' });
  crud.create('MenuItem', { name: 'Butter Chicken', description: 'Tender chicken in creamy tomato gravy', price: 350, category: 'main_course' });
  crud.create('MenuItem', { name: 'Dal Makhani', description: 'Slow-cooked black lentils in butter', price: 220, category: 'main_course' });
  crud.create('MenuItem', { name: 'Biryani', description: 'Fragrant rice with spices and vegetables', price: 300, category: 'main_course' });
  crud.create('MenuItem', { name: 'Gulab Jamun', description: 'Soft milk dumplings in sugar syrup', price: 120, category: 'dessert' });
  crud.create('MenuItem', { name: 'Mango Lassi', description: 'Refreshing yogurt drink with mango', price: 90, category: 'beverage' });
  crud.create('MenuItem', { name: 'Masala Chai', description: 'Spiced Indian tea', price: 50, category: 'beverage' });

  // Today's reservations
  crud.create('Reservation', { customer_id: rahulId, table_id: table2, date: `${today}T18:00:00`, party_size: 4, status: 'confirmed', special_requests: 'Birthday celebration - need cake' });
  crud.create('Reservation', { customer_id: priyaId, table_id: table4, date: `${today}T19:30:00`, party_size: 6, status: 'confirmed', special_requests: 'Vegetarian only' });
  crud.create('Reservation', { customer_id: vikramId, table_id: table3, date: `${today}T20:00:00`, party_size: 2, status: 'pending' });

  // Tomorrow's reservations
  crud.create('Reservation', { customer_id: ananyaId, table_id: table5, date: `${tomorrowStr}T19:00:00`, party_size: 8, status: 'confirmed', special_requests: 'Corporate dinner' });
  crud.create('Reservation', { customer_id: rahulId, table_id: table1, date: `${tomorrowStr}T20:30:00`, party_size: 2, status: 'confirmed' });

  // Orders
  crud.create('Order', { customer_id: rahulId, order_date: `${today}T12:30:00`, total_amount: 850, order_type: 'dine_in', status: 'completed' });
  crud.create('Order', { customer_id: priyaId, order_date: `${today}T13:00:00`, total_amount: 540, order_type: 'takeout', status: 'ready' });
  crud.create('Order', { customer_id: vikramId, order_date: `${today}T13:15:00`, total_amount: 720, order_type: 'delivery', status: 'preparing', delivery_address: '42 MG Road, Bangalore' });
  crud.create('Order', { customer_id: ananyaId, order_date: `${today}T11:45:00`, total_amount: 1200, order_type: 'dine_in', status: 'completed' });

  // Past orders for history
  for (let i = 1; i <= 5; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i);
    const orderData: Record<string, any> = {
      customer_id: rahulId,
      order_date: pastDate.toISOString(),
      total_amount: 400 + i * 100,
      order_type: i % 2 === 0 ? 'dine_in' : 'delivery',
      status: 'completed',
    };
    if (i % 2 !== 0) {
      orderData.delivery_address = '15 Brigade Road, Bangalore';
    }
    crud.create('Order', orderData);
  }
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

function seedDoctorData(crud: CrudService): void {
  const today = new Date();
  const todayStr = today.toISOString();

  // Patients
  const rahulId = crud.create('Patient', { name: 'Rahul Sharma', phone: '9876543210', blood_group: 'O+', allergies: 'Penicillin' });
  const priyaId = crud.create('Patient', { name: 'Priya Mehta', phone: '9876543211', blood_group: 'A+' });
  const anilId = crud.create('Patient', { name: 'Anil Kumar', phone: '9876543212', blood_group: 'B+', allergies: 'Dust, Pollen' });

  // Today's appointments
  const apt1Time = new Date(today);
  apt1Time.setHours(10, 0, 0, 0);
  crud.create('Appointment', { patient_id: rahulId, datetime: apt1Time.toISOString(), reason: 'Follow-up checkup', status: 'scheduled' });

  const apt2Time = new Date(today);
  apt2Time.setHours(11, 30, 0, 0);
  crud.create('Appointment', { patient_id: priyaId, datetime: apt2Time.toISOString(), reason: 'Fever and cold', status: 'scheduled' });

  const apt3Time = new Date(today);
  apt3Time.setHours(14, 0, 0, 0);
  crud.create('Appointment', { patient_id: anilId, datetime: apt3Time.toISOString(), reason: 'Annual checkup', status: 'scheduled' });

  // Past appointments for timeline
  for (let i = 1; i <= 5; i++) {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - i * 7);
    pastDate.setHours(10, 0, 0, 0);
    crud.create('Appointment', {
      patient_id: rahulId,
      datetime: pastDate.toISOString(),
      reason: 'Regular checkup',
      status: 'completed',
    });
  }

  // Prescriptions
  const todayDate = today.toISOString().split('T')[0];
  crud.create('Prescription', {
    patient_id: rahulId,
    date: todayDate,
    diagnosis: 'Mild hypertension',
    medications: 'Amlodipine 5mg - Once daily',
    instructions: 'Reduce salt intake, exercise regularly',
  });

  crud.create('Prescription', {
    patient_id: priyaId,
    date: todayDate,
    diagnosis: 'Viral fever',
    medications: 'Paracetamol 500mg - As needed, Vitamin C',
    instructions: 'Rest and hydration',
  });

  // Notes
  crud.create('Note', { patient_id: rahulId, content: 'Patient reports feeling better. BP: 130/85', date: todayDate });
}
