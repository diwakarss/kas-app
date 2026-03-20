/**
 * Mock Backend Server
 * Simulates InsForge API for local development
 */

const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT || 7135;

// In-memory storage
const specs = new Map();
const users = new Map();

// Sample spec template
const sampleSpec = {
  meta: {
    spec_id: '',
    name: '',
    version: 1,
  },
  entities: [
    {
      name: 'Customer',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'phone', type: 'phone', required: false },
      ],
      relationships: [],
    },
    {
      name: 'Service',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'price', type: 'currency', required: true },
        { name: 'duration', type: 'duration', required: false },
      ],
      relationships: [],
    },
    {
      name: 'Appointment',
      fields: [
        { name: 'date', type: 'datetime', required: true },
        { name: 'notes', type: 'note', required: false },
        { name: 'status', type: 'choice', required: true },
      ],
      relationships: [
        { target: 'Customer', type: 'belongs_to' },
        { target: 'Service', type: 'belongs_to' },
      ],
    },
  ],
  anchor: { entity: 'Appointment' },
  computed_fields: {},
  business_rules: [],
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Parse JSON body
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Send JSON response
function sendJson(res, data, status = 200) {
  res.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Send SSE response
function sendSSE(res, events) {
  res.writeHead(200, {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let index = 0;
  const interval = setInterval(() => {
    if (index < events.length) {
      res.write(`data: ${JSON.stringify(events[index])}\n\n`);
      index++;
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 500);
}

// Route handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  // Health check
  if (path === '/health') {
    return sendJson(res, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // Auth endpoints
  if (path === '/auth/signup' && method === 'POST') {
    const body = await parseBody(req);
    const userId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    users.set(userId, { ...body, id: userId, token });
    return sendJson(res, { user: { id: userId, email: body.email }, token });
  }

  if (path === '/auth/login' && method === 'POST') {
    const body = await parseBody(req);
    const token = crypto.randomBytes(32).toString('hex');
    const userId = crypto.randomUUID();
    return sendJson(res, { user: { id: userId, email: body.email }, token });
  }

  // Generate spec (SSE)
  if (path === '/api/specs/generate' && method === 'POST') {
    const body = await parseBody(req);
    const specId = crypto.randomUUID();
    const spec = {
      ...sampleSpec,
      meta: {
        spec_id: specId,
        name: body.businessName || 'My Business App',
        version: 1,
      },
    };
    specs.set(specId, spec);

    const events = [
      { type: 'progress', step: 1, message: 'Analyzing business type...', subtitle: 'Understanding your business needs' },
      { type: 'progress', step: 2, message: 'Generating entities...', subtitle: 'Creating your data structure' },
      { type: 'progress', step: 3, message: 'Building relationships...', subtitle: 'Connecting your business logic' },
      { type: 'progress', step: 4, message: 'Validating spec...', subtitle: 'Making sure everything works' },
      { type: 'complete', specId, spec },
    ];

    return sendSSE(res, events);
  }

  // List specs
  if (path === '/api/specs' && method === 'GET') {
    const allSpecs = Array.from(specs.entries()).map(([id, spec]) => ({
      id,
      name: spec.meta.name,
      version: spec.meta.version,
      created_at: new Date().toISOString(),
    }));
    return sendJson(res, { data: allSpecs });
  }

  // Get spec by ID
  const specMatch = path.match(/^\/api\/specs\/([^/]+)$/);
  if (specMatch && method === 'GET') {
    const specId = specMatch[1];
    const spec = specs.get(specId);
    if (spec) {
      return sendJson(res, { data: spec });
    }
    return sendJson(res, { error: 'Not found' }, 404);
  }

  // Preview endpoint
  const previewMatch = path.match(/^\/api\/preview\/([^/]+)$/);
  if (previewMatch && method === 'GET') {
    const specId = previewMatch[1];
    let spec = specs.get(specId);

    // Return sample spec if not found
    if (!spec) {
      spec = {
        ...sampleSpec,
        meta: { spec_id: specId, name: 'Preview App', version: 1 },
      };
    }

    const sampleData = {
      Customer: [
        { id: '1', name: 'John Smith', email: 'john@example.com', phone: '555-1234' },
        { id: '2', name: 'Jane Doe', email: 'jane@example.com', phone: '555-5678' },
      ],
      Service: [
        { id: '1', name: 'Consultation', price: 100, duration: 60 },
        { id: '2', name: 'Follow-up', price: 50, duration: 30 },
      ],
      Appointment: [
        { id: '1', date: '2026-03-21T10:00:00', notes: 'First visit', status: 'Scheduled', customer_id: '1', service_id: '1' },
      ],
    };

    return sendJson(res, { spec, sampleData });
  }

  // 404 for unknown routes
  sendJson(res, { error: 'Not found', path }, 404);
}

// Create server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n🚀 Mock Backend Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GET  /health              - Health check`);
  console.log(`  POST /auth/signup         - Create account`);
  console.log(`  POST /auth/login          - Sign in`);
  console.log(`  POST /api/specs/generate  - Generate spec (SSE)`);
  console.log(`  GET  /api/specs           - List specs`);
  console.log(`  GET  /api/specs/:id       - Get spec`);
  console.log(`  GET  /api/preview/:id     - Preview spec\n`);
});
