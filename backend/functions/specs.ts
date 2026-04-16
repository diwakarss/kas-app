/**
 * Edge Function: Specs CRUD
 *
 * Handles spec-related API endpoints:
 *   GET  /api/specs      - List user's specs
 *   GET  /api/specs/:id  - Get spec by ID
 *   PUT  /api/specs/:id  - Update spec (creates new version)
 *   DELETE /api/specs/:id - Archive spec (soft delete)
 */

import { createClient } from '@insforge/client';

interface InsForgeContext {
  req: Request;
  env: { DATABASE_URL: string };
  user?: { id: string; email: string };
  params?: { id?: string };
}

export default async function handler(ctx: InsForgeContext): Promise<Response> {
  const { req, env, user, params } = ctx;
  const db = createClient(env.DATABASE_URL);
  const method = req.method;

  // All spec endpoints require authentication
  if (!user) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  // Route based on method and params
  if (method === 'GET' && !params?.id) {
    return listSpecs(db, user.id);
  }

  if (method === 'GET' && params?.id) {
    return getSpec(db, user.id, params.id);
  }

  if (method === 'PUT' && params?.id) {
    const body = await req.json();
    return updateSpec(db, user.id, params.id, body);
  }

  if (method === 'DELETE' && params?.id) {
    return deleteSpec(db, user.id, params.id);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

/**
 * GET /api/specs - List all specs for the authenticated user
 */
async function listSpecs(
  db: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  const apps = await db
    .from('app_instance')
    .select(`
      id,
      name,
      business_type,
      current_version,
      created_at,
      updated_at,
      spec_version!inner (
        id,
        version,
        spec_hash,
        created_at
      )
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  // Get latest spec version for each app
  const specsWithLatest = apps.map((app: any) => {
    const latestVersion = app.spec_version
      .sort((a: any, b: any) => b.version - a.version)[0];

    return {
      id: app.id,
      name: app.name,
      business_type: app.business_type,
      current_version: app.current_version,
      spec_id: latestVersion?.id,
      spec_hash: latestVersion?.spec_hash,
      created_at: app.created_at,
      updated_at: app.updated_at,
    };
  });

  return jsonResponse({ specs: specsWithLatest });
}

/**
 * GET /api/specs/:id - Get a specific spec by ID
 */
async function getSpec(
  db: ReturnType<typeof createClient>,
  userId: string,
  specId: string
): Promise<Response> {
  // Try to find by spec_version ID
  let specVersion = await db
    .from('spec_version')
    .select(`
      id,
      version,
      spec_json,
      spec_hash,
      producer,
      change_class,
      change_description,
      created_at,
      app_instance!inner (
        id,
        user_id,
        name,
        business_type,
        business_description
      )
    `)
    .eq('id', specId)
    .single();

  // If not found by spec_version ID, try app_instance ID (get latest version)
  if (!specVersion) {
    const appInstance = await db
      .from('app_instance')
      .select('id, user_id')
      .eq('id', specId)
      .eq('is_active', true)
      .single();

    if (appInstance) {
      specVersion = await db
        .from('spec_version')
        .select(`
          id,
          version,
          spec_json,
          spec_hash,
          producer,
          change_class,
          change_description,
          created_at,
          app_instance!inner (
            id,
            user_id,
            name,
            business_type,
            business_description
          )
        `)
        .eq('app_instance_id', appInstance.id)
        .order('version', { ascending: false })
        .limit(1)
        .single();
    }
  }

  if (!specVersion) {
    return jsonResponse({ error: 'Spec not found' }, 404);
  }

  // Check ownership
  if (specVersion.app_instance.user_id !== userId) {
    return jsonResponse({ error: 'Access denied' }, 403);
  }

  return jsonResponse({
    id: specVersion.id,
    app_instance_id: specVersion.app_instance.id,
    version: specVersion.version,
    spec: specVersion.spec_json,
    spec_hash: specVersion.spec_hash,
    producer: specVersion.producer,
    change_class: specVersion.change_class,
    change_description: specVersion.change_description,
    created_at: specVersion.created_at,
    app: {
      name: specVersion.app_instance.name,
      business_type: specVersion.app_instance.business_type,
      business_description: specVersion.app_instance.business_description,
    },
  });
}

/**
 * PUT /api/specs/:id - Update a spec (creates new version)
 */
async function updateSpec(
  db: ReturnType<typeof createClient>,
  userId: string,
  specId: string,
  body: { spec: object; change_description?: string }
): Promise<Response> {
  if (!body.spec) {
    return jsonResponse({ error: 'spec is required' }, 400);
  }

  // Find the app instance
  const appInstance = await db
    .from('app_instance')
    .select('id, user_id, current_version')
    .eq('id', specId)
    .eq('is_active', true)
    .single();

  if (!appInstance) {
    return jsonResponse({ error: 'App not found' }, 404);
  }

  if (appInstance.user_id !== userId) {
    return jsonResponse({ error: 'Access denied' }, 403);
  }

  // Create new spec version
  const { createHash } = await import('crypto');
  const specHash = createHash('sha256')
    .update(JSON.stringify(body.spec))
    .digest('hex');

  const newVersion = appInstance.current_version + 1;

  const specVersion = await db
    .from('spec_version')
    .insert({
      app_instance_id: appInstance.id,
      version: newVersion,
      spec_json: body.spec,
      spec_hash: specHash,
      producer: 'human',
      change_class: 'M',
      change_description: body.change_description || 'Manual update',
    })
    .select()
    .single();

  // Update app instance version
  await db
    .from('app_instance')
    .update({ current_version: newVersion })
    .eq('id', appInstance.id);

  return jsonResponse({
    id: specVersion.id,
    app_instance_id: appInstance.id,
    version: newVersion,
    spec_hash: specHash,
    created_at: specVersion.created_at,
  });
}

/**
 * DELETE /api/specs/:id - Archive a spec (soft delete)
 */
async function deleteSpec(
  db: ReturnType<typeof createClient>,
  userId: string,
  specId: string
): Promise<Response> {
  // Find the app instance
  const appInstance = await db
    .from('app_instance')
    .select('id, user_id')
    .eq('id', specId)
    .eq('is_active', true)
    .single();

  if (!appInstance) {
    return jsonResponse({ error: 'App not found' }, 404);
  }

  if (appInstance.user_id !== userId) {
    return jsonResponse({ error: 'Access denied' }, 403);
  }

  // Soft delete (archive)
  await db
    .from('app_instance')
    .update({ is_active: false })
    .eq('id', appInstance.id);

  return new Response(null, { status: 204 });
}

/**
 * Helper to create JSON response
 */
function jsonResponse(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
