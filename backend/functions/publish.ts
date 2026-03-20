/**
 * Publish Endpoint
 *
 * Handles spec publishing with release envelope creation.
 * Server is authoritative for version lineage.
 *
 * POST /api/specs/:id/publish
 * Body: { spec, producer?, changeDescription? }
 * Returns: { success, envelope, specVersionId }
 */

import { InsForgeClient } from '@insforge/client';
import {
  computeSpecHash,
  classifyChange,
  validateSpec,
  createReleaseEnvelope,
  ReleaseEnvelope,
} from './release-envelope';

const client = new InsForgeClient();

interface PublishRequest {
  spec: Record<string, unknown>;
  producer?: 'human' | 'agent';
  changeDescription?: string;
}

interface PublishResponse {
  success: boolean;
  data?: {
    envelope: ReleaseEnvelope;
    specVersionId: string;
    version: number;
  };
  error?: string;
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract app instance ID from URL
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const appInstanceId = pathParts[pathParts.indexOf('specs') + 1];

  if (!appInstanceId) {
    return new Response(JSON.stringify({ error: 'Missing app instance ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify authentication
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.slice(7);
  const { user, error: authError } = await client.auth.getUser(token);

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body: PublishRequest = await req.json();
    const { spec, producer = 'human', changeDescription } = body;

    // Validate spec structure
    const validationErrors = validateSpec(spec);
    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid spec',
          details: validationErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const { data: appInstance, error: fetchError } = await client
      .from('app_instance')
      .select('id, user_id, current_version')
      .eq('id', appInstanceId)
      .single();

    if (fetchError || !appInstance) {
      return new Response(JSON.stringify({ error: 'App not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (appInstance.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get previous version for change classification
    let previousSpec: Record<string, unknown> | null = null;
    let previousHash: string | undefined;

    if (appInstance.current_version > 0) {
      const { data: prevVersion } = await client
        .from('spec_version')
        .select('spec_json, spec_hash')
        .eq('app_instance_id', appInstanceId)
        .eq('version', appInstance.current_version)
        .single();

      if (prevVersion) {
        previousSpec = prevVersion.spec_json as Record<string, unknown>;
        previousHash = prevVersion.spec_hash;
      }
    }

    // Classify the change
    const changeClass = classifyChange(previousSpec, spec);
    const newVersion = appInstance.current_version + 1;

    // Compute spec hash
    const specHash = computeSpecHash(spec);

    // Check for duplicate (same hash as previous)
    if (previousHash === specHash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No changes detected',
          details: 'Spec is identical to current version',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create spec version record
    const { data: specVersion, error: insertError } = await client
      .from('spec_version')
      .insert({
        app_instance_id: appInstanceId,
        version: newVersion,
        spec_json: spec,
        spec_hash: specHash,
        producer,
        change_class: changeClass,
        change_description: changeDescription,
      })
      .select('id')
      .single();

    if (insertError || !specVersion) {
      console.error('[Publish] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create version' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update app instance current version
    const { error: updateError } = await client
      .from('app_instance')
      .update({ current_version: newVersion })
      .eq('id', appInstanceId);

    if (updateError) {
      console.error('[Publish] Update error:', updateError);
      // Version was created, but current_version not updated - log but don't fail
    }

    // Create release envelope
    const envelope = createReleaseEnvelope(
      appInstanceId,
      newVersion,
      spec,
      producer,
      changeClass,
      changeDescription,
      appInstance.current_version > 0 ? appInstance.current_version : undefined,
      previousHash
    );

    const response: PublishResponse = {
      success: true,
      data: {
        envelope,
        specVersionId: specVersion.id,
        version: newVersion,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[Publish] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
