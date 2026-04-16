/**
 * Edge Function: Generate Spec
 *
 * POST /api/specs/generate
 *
 * Generates a KAS App spec from a business description.
 * Streams progress via SSE when Accept: text/event-stream header is present.
 *
 * Request body:
 *   { business_name: string, business_description: string }
 *
 * Response (JSON):
 *   { spec_id: string, spec: KASAppSpec, app_instance_id: string }
 *
 * Response (SSE):
 *   data: { step: number, total: 5, message: string, status: 'in_progress' | 'complete' | 'error' }
 *
 * Rate limits: 10/hour, 100/day per user (configured in InsForge)
 */

import { createClient } from '@insforge/client';
import { generateSpec } from '../../src/generation';
import { calculateCost, logGenerationMetrics } from '../../src/generation/services/cost-tracker';
import { createHash } from 'crypto';

// Progress steps for SSE streaming
const PROGRESS_STEPS = [
  { step: 1, message: 'Analyzing business type...', subtitle: 'Understanding your business needs' },
  { step: 2, message: 'Generating entities...', subtitle: 'Creating your data structure' },
  { step: 3, message: 'Building relationships...', subtitle: 'Connecting your business logic' },
  { step: 4, message: 'Validating spec...', subtitle: 'Making sure everything works' },
  { step: 5, message: 'Complete!', subtitle: 'Your app is ready' },
];

interface GenerateRequest {
  business_name: string;
  business_description: string;
}

interface InsForgeContext {
  req: Request;
  env: {
    DATABASE_URL: string;
    DEEPINFRA_API_KEY: string;
    ENABLE_PROGRESS_SSE: string;
  };
  user?: {
    id: string;
    email: string;
  };
}

export default async function handler(ctx: InsForgeContext): Promise<Response> {
  const { req, env, user } = ctx;

  // Require authentication
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse request body
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate required fields
  if (!body.business_name?.trim()) {
    return new Response(
      JSON.stringify({ error: 'business_name is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!body.business_description?.trim()) {
    return new Response(
      JSON.stringify({ error: 'business_description is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  const db = createClient(env.DATABASE_URL);

  // Check if SSE streaming is requested
  const acceptHeader = req.headers.get('Accept') || '';
  const useSSE = acceptHeader.includes('text/event-stream') && env.ENABLE_PROGRESS_SSE === 'true';

  if (useSSE) {
    return handleSSEGeneration(ctx, body, db, startTime);
  } else {
    return handleJSONGeneration(ctx, body, db, startTime);
  }
}

/**
 * Handle generation with SSE progress streaming
 */
async function handleSSEGeneration(
  ctx: InsForgeContext,
  body: GenerateRequest,
  db: ReturnType<typeof createClient>,
  startTime: number
): Promise<Response> {
  const { env, user } = ctx;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Step 1: Analyzing
        sendEvent({ step: 1, total: 5, ...PROGRESS_STEPS[0], status: 'in_progress' });

        // Generate the spec
        const result = await generateSpec({
          businessName: body.business_name,
          businessDescription: body.business_description,
          apiKey: env.DEEPINFRA_API_KEY,
          onProgress: (step: number) => {
            if (step >= 2 && step <= 4) {
              sendEvent({ step, total: 5, ...PROGRESS_STEPS[step - 1], status: 'in_progress' });
            }
          },
        });

        // Step 4: Validating
        sendEvent({ step: 4, total: 5, ...PROGRESS_STEPS[3], status: 'in_progress' });

        // Store in database
        const specHash = createHash('sha256')
          .update(JSON.stringify(result.spec))
          .digest('hex');

        // Create app instance
        const appInstance = await db
          .from('app_instance')
          .insert({
            user_id: user!.id,
            name: body.business_name,
            business_type: result.businessType || 'custom',
            business_description: body.business_description,
          })
          .select()
          .single();

        // Create spec version
        const specVersion = await db
          .from('spec_version')
          .insert({
            app_instance_id: appInstance.id,
            version: 1,
            spec_json: result.spec,
            spec_hash: specHash,
            producer: 'agent',
            change_class: 'S',
            change_description: 'Initial generation',
          })
          .select()
          .single();

        // Log generation metrics
        const latencyMs = Date.now() - startTime;
        await db.from('generation_run').insert({
          app_instance_id: appInstance.id,
          user_id: user!.id,
          business_name: body.business_name,
          business_description: body.business_description,
          business_type: result.businessType,
          success: true,
          spec_version_id: specVersion.id,
          generation_method: result.method,
          template_used: result.templateUsed,
          latency_ms: latencyMs,
          token_count_input: result.usage?.inputTokens,
          token_count_output: result.usage?.outputTokens,
          cost_usd: result.cost?.totalCostUsd,
          model_id: result.modelId,
          provider: result.provider,
        });

        // Step 5: Complete
        sendEvent({
          step: 5,
          total: 5,
          ...PROGRESS_STEPS[4],
          status: 'complete',
          result: {
            spec_id: specVersion.id,
            app_instance_id: appInstance.id,
            spec: result.spec,
          },
        });

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Generation failed';

        // Log failed generation
        await db.from('generation_run').insert({
          user_id: user!.id,
          business_name: body.business_name,
          business_description: body.business_description,
          success: false,
          error_message: errorMessage,
          generation_method: 'unknown',
          latency_ms: Date.now() - startTime,
        });

        sendEvent({
          step: 0,
          total: 5,
          message: 'Generation failed',
          subtitle: errorMessage,
          status: 'error',
        });

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Handle generation with JSON response (no streaming)
 */
async function handleJSONGeneration(
  ctx: InsForgeContext,
  body: GenerateRequest,
  db: ReturnType<typeof createClient>,
  startTime: number
): Promise<Response> {
  const { env, user } = ctx;

  try {
    // Generate the spec
    const result = await generateSpec({
      businessName: body.business_name,
      businessDescription: body.business_description,
      apiKey: env.DEEPINFRA_API_KEY,
    });

    // Store in database
    const specHash = createHash('sha256')
      .update(JSON.stringify(result.spec))
      .digest('hex');

    // Create app instance
    const appInstance = await db
      .from('app_instance')
      .insert({
        user_id: user!.id,
        name: body.business_name,
        business_type: result.businessType || 'custom',
        business_description: body.business_description,
      })
      .select()
      .single();

    // Create spec version
    const specVersion = await db
      .from('spec_version')
      .insert({
        app_instance_id: appInstance.id,
        version: 1,
        spec_json: result.spec,
        spec_hash: specHash,
        producer: 'agent',
        change_class: 'S',
        change_description: 'Initial generation',
      })
      .select()
      .single();

    // Log generation metrics
    const latencyMs = Date.now() - startTime;
    await db.from('generation_run').insert({
      app_instance_id: appInstance.id,
      user_id: user!.id,
      business_name: body.business_name,
      business_description: body.business_description,
      business_type: result.businessType,
      success: true,
      spec_version_id: specVersion.id,
      generation_method: result.method,
      template_used: result.templateUsed,
      latency_ms: latencyMs,
      token_count_input: result.usage?.inputTokens,
      token_count_output: result.usage?.outputTokens,
      cost_usd: result.cost?.totalCostUsd,
      model_id: result.modelId,
      provider: result.provider,
    });

    return new Response(
      JSON.stringify({
        spec_id: specVersion.id,
        app_instance_id: appInstance.id,
        spec: result.spec,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Generation failed';

    // Log failed generation
    await db.from('generation_run').insert({
      user_id: user!.id,
      business_name: body.business_name,
      business_description: body.business_description,
      success: false,
      error_message: errorMessage,
      generation_method: 'unknown',
      latency_ms: Date.now() - startTime,
    });

    // Return appropriate error
    const isValidationError = errorMessage.includes('validation');
    const isRateLimitError = errorMessage.includes('rate limit');

    return new Response(
      JSON.stringify({
        error: isValidationError ? 'Invalid spec generated' : 'Generation failed',
        message: errorMessage,
      }),
      {
        status: isRateLimitError ? 429 : isValidationError ? 400 : 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
