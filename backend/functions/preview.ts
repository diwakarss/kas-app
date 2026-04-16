/**
 * Edge Function: Preview
 *
 * GET /api/preview/:id - Get preview data (public endpoint)
 *
 * Returns spec data for preview embedding. This is a PUBLIC endpoint
 * to allow anonymous preview before signup.
 *
 * Response includes:
 * - Spec JSON
 * - Sample data for preview mode
 * - App metadata (name, business type)
 */

import { createClient } from '@insforge/client';

interface InsForgeContext {
  req: Request;
  env: { DATABASE_URL: string };
  params?: { id?: string };
}

interface SampleData {
  [entityName: string]: object[];
}

export default async function handler(ctx: InsForgeContext): Promise<Response> {
  const { env, params } = ctx;
  const db = createClient(env.DATABASE_URL);

  if (!params?.id) {
    return jsonResponse({ error: 'Preview ID required' }, 400);
  }

  const previewId = params.id;

  // Try to find by spec_version ID first
  let specVersion = await db
    .from('spec_version')
    .select(`
      id,
      version,
      spec_json,
      app_instance!inner (
        id,
        name,
        business_type,
        is_active
      )
    `)
    .eq('id', previewId)
    .single();

  // If not found, try by app_instance ID (get latest version)
  if (!specVersion) {
    const appInstance = await db
      .from('app_instance')
      .select('id')
      .eq('id', previewId)
      .eq('is_active', true)
      .single();

    if (appInstance) {
      specVersion = await db
        .from('spec_version')
        .select(`
          id,
          version,
          spec_json,
          app_instance!inner (
            id,
            name,
            business_type,
            is_active
          )
        `)
        .eq('app_instance_id', appInstance.id)
        .order('version', { ascending: false })
        .limit(1)
        .single();
    }
  }

  if (!specVersion) {
    return jsonResponse({ error: 'Preview not found' }, 404);
  }

  if (!specVersion.app_instance.is_active) {
    return jsonResponse({ error: 'Preview not available' }, 404);
  }

  // Generate sample data for preview mode
  const sampleData = generateSampleData(specVersion.spec_json);

  return jsonResponse({
    preview_id: specVersion.id,
    app_instance_id: specVersion.app_instance.id,
    app_name: specVersion.app_instance.name,
    business_type: specVersion.app_instance.business_type,
    version: specVersion.version,
    spec: specVersion.spec_json,
    sample_data: sampleData,
    preview_mode: true,
  });
}

/**
 * Generate sample data for each entity in the spec
 */
function generateSampleData(spec: any): SampleData {
  const sampleData: SampleData = {};

  if (!spec?.entities || !Array.isArray(spec.entities)) {
    return sampleData;
  }

  for (const entity of spec.entities) {
    const entityName = entity.name;
    const records: object[] = [];

    // Generate 3-5 sample records
    const recordCount = entity.name.toLowerCase().includes('note') ? 5 : 3;

    for (let i = 0; i < recordCount; i++) {
      const record = generateSampleRecord(entity, i);
      records.push(record);
    }

    sampleData[entityName] = records;
  }

  return sampleData;
}

/**
 * Generate a single sample record for an entity
 */
function generateSampleRecord(entity: any, index: number): object {
  const record: any = {
    id: `sample-${entity.name.toLowerCase()}-${index + 1}`,
    _created_at: getRandomPastDate(index),
    _updated_at: new Date().toISOString(),
  };

  if (!entity.fields || !Array.isArray(entity.fields)) {
    return record;
  }

  for (const field of entity.fields) {
    const value = generateFieldValue(field, entity.name, index);
    if (value !== undefined) {
      record[field.name] = value;
    }
  }

  return record;
}

/**
 * Generate a sample value for a field based on its type
 */
function generateFieldValue(field: any, entityName: string, index: number): any {
  const fieldName = field.name.toLowerCase();
  const fieldType = field.type?.toLowerCase() || 'text';

  // Special handling for common field names
  if (fieldName.includes('name')) {
    return getSampleName(entityName, index);
  }
  if (fieldName.includes('phone') || fieldName.includes('mobile')) {
    return `+91 98765 4321${index}`;
  }
  if (fieldName.includes('email')) {
    return `sample${index + 1}@example.com`;
  }
  if (fieldName.includes('address')) {
    return `${100 + index} Sample Street, City`;
  }

  // Type-based generation
  switch (fieldType) {
    case 'text':
    case 'string':
      return getSampleText(fieldName, index);

    case 'number':
    case 'integer':
      return (index + 1) * 10;

    case 'currency':
    case 'money':
      return (index + 1) * 1000;

    case 'date':
      return getRandomDate(index);

    case 'datetime':
    case 'timestamp':
      return getRandomDateTime(index);

    case 'time':
      return `${9 + index}:00`;

    case 'boolean':
      return index % 2 === 0;

    case 'choice':
    case 'select':
      if (field.options && Array.isArray(field.options)) {
        return field.options[index % field.options.length];
      }
      return 'Option 1';

    case 'reference':
      return `sample-${field.reference?.toLowerCase() || 'entity'}-1`;

    default:
      return `Sample ${fieldName} ${index + 1}`;
  }
}

/**
 * Get a sample name based on entity type
 */
function getSampleName(entityName: string, index: number): string {
  const entityLower = entityName.toLowerCase();

  const names = {
    student: ['Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Gupta', 'Ravi Singh'],
    customer: ['Anjali Verma', 'Suresh Reddy', 'Meera Nair', 'Vikram Shah', 'Pooja Joshi'],
    client: ['Ramesh Rao', 'Sunita Menon', 'Arun Pillai', 'Kavitha Iyer', 'Mohan Das'],
    class: ['Morning Batch', 'Evening Batch', 'Weekend Class', 'Advanced Session', 'Beginner Class'],
    product: ['Premium Widget', 'Standard Item', 'Basic Package', 'Deluxe Bundle', 'Essential Kit'],
    default: [`Sample ${entityName} ${index + 1}`],
  };

  const nameList = names[entityLower as keyof typeof names] || names.default;
  return nameList[index % nameList.length];
}

/**
 * Get sample text based on field name
 */
function getSampleText(fieldName: string, index: number): string {
  if (fieldName.includes('description') || fieldName.includes('note')) {
    const notes = [
      'Good progress this month.',
      'Follow up next week.',
      'Completed all requirements.',
      'Needs additional attention.',
      'On track for goals.',
    ];
    return notes[index % notes.length];
  }

  return `Sample ${fieldName} ${index + 1}`;
}

/**
 * Get a random date in the past
 */
function getRandomPastDate(index: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (index * 7 + Math.floor(Math.random() * 7)));
  return date.toISOString().split('T')[0];
}

/**
 * Get a random future date
 */
function getRandomDate(index: number): string {
  const date = new Date();
  date.setDate(date.getDate() + (index * 3 + Math.floor(Math.random() * 7)));
  return date.toISOString().split('T')[0];
}

/**
 * Get a random datetime
 */
function getRandomDateTime(index: number): string {
  const date = new Date();
  date.setDate(date.getDate() + index);
  date.setHours(9 + index, 0, 0, 0);
  return date.toISOString();
}

/**
 * Helper to create JSON response
 */
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60', // Cache preview data for 1 minute
    },
  });
}
