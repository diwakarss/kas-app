/**
 * Dependency Cruiser Configuration
 *
 * Enforces architecture boundaries defined in:
 * - architecture/constitution/block-boundaries.yaml
 * - architecture/constitution/layer-boundaries.yaml
 *
 * Wave 2 Bridge Work: lint:architecture CI job
 */

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ═══════════════════════════════════════════════════════════════
    // Block 3 Internal Boundaries (from block-boundaries.yaml)
    // ═══════════════════════════════════════════════════════════════

    {
      name: 'runtime-core-cannot-import-spec-runtime',
      comment: 'Core context cannot depend on screens (extensible runtime)',
      severity: 'error',
      from: {
        path: '^src/core/context/',
        pathNot: '^src/core/context/.*Provider\\.tsx$', // Exception for providers
      },
      to: {
        path: '^src/screens/',
      },
    },
    // Note: Navigation importing screens is allowed — that's its purpose
    {
      name: 'runtime-core-cannot-import-engines-directly',
      comment: 'Core context cannot depend on engines directly (except providers)',
      severity: 'error',
      from: {
        path: '^src/core/context/SpecContext\\.tsx$',
      },
      to: {
        path: '^src/engines/',
      },
    },
    {
      name: 'engines-cannot-import-ui',
      comment: 'Engines are pure logic — no UI dependencies',
      severity: 'error',
      from: {
        path: '^src/engines/',
      },
      to: {
        path: '^src/(screens|components)/',
      },
    },
    {
      name: 'engines-cannot-import-core-runtime',
      comment: 'Engines cannot depend on runtime-core (except types)',
      severity: 'error',
      from: {
        path: '^src/engines/',
      },
      to: {
        path: '^src/core/(context|navigation)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // Layer Boundaries (from layer-boundaries.yaml)
    // ═══════════════════════════════════════════════════════════════

    {
      name: 'domain-cannot-import-implementation',
      comment: 'Domain layer (types) cannot import implementation layers',
      severity: 'error',
      from: {
        path: '^src/core/types/',
      },
      to: {
        path: '^src/(engines|data|screens|components|hooks|core/context|core/navigation)/',
      },
    },
    {
      name: 'application-cannot-import-ui',
      comment: 'Application layer (engines) cannot import UI',
      severity: 'error',
      from: {
        path: '^src/engines/',
      },
      to: {
        path: '^src/(screens|components|hooks)/',
      },
    },
    {
      name: 'adapters-cannot-import-ui',
      comment: 'Adapters (data) cannot import UI layer',
      severity: 'error',
      from: {
        path: '^src/data/',
      },
      to: {
        path: '^src/(screens|components)/',
      },
    },

    // ═══════════════════════════════════════════════════════════════
    // General Best Practices
    // ═══════════════════════════════════════════════════════════════

    {
      name: 'no-circular',
      comment: 'Circular dependencies create maintenance nightmares',
      severity: 'error',
      from: {
        // Provider <-> Context circularity is a known React pattern
        // This is acceptable for context initialization
        pathNot: '^src/core/context/(SpecContext|NativeSpecProvider|WebSpecProvider)\\.tsx$',
      },
      to: {
        circular: true,
      },
    },
    {
      name: 'no-orphans',
      comment: 'Files should be imported by at least one other file',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|ts|json)$', // dot files
          '\\.d\\.ts$',                          // TypeScript declarations
          '(^|/)tsconfig\\.json$',              // TypeScript config
          '(^|/)(babel|jest|metro)\\.config\\.(js|ts|cjs)$', // Bundler configs
          '^App\\.tsx$',                        // Entry point
          '^index\\.ts$',                       // Entry point
          '__tests__/',                          // Test files
          '\\.test\\.tsx?$',                    // Test files
          '^assets/',                            // Static assets
        ],
      },
      to: {},
    },
    {
      name: 'no-deprecated-core',
      comment: 'Do not use deprecated Node.js core modules',
      severity: 'warn',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: [
          '^(v8/tools/codemap)$',
          '^(v8/tools/consarray)$',
          '^(v8/tools/csvparser)$',
          '^(v8/tools/logreader)$',
          '^(v8/tools/profile_view)$',
          '^(v8/tools/profile)$',
          '^(v8/tools/SourceMap)$',
          '^(v8/tools/splaytree)$',
          '^(v8/tools/tickprocessor-driver)$',
          '^(v8/tools/tickprocessor)$',
          '^(node-hierarchical-inspect)$',
          '^(_linklist)$',
          '^(_stream_wrap)$',
          '^(async_hooks)$',
          '^(inspector)$',
          '^(trace_events)$',
          '^(v8)$',
          '^(vm)$',
          '^(wasi)$',
        ],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        '\\.expo',
        '\\.git',
        'android',
        'ios',
        'assets',
      ],
    },
    exclude: {
      path: [
        'node_modules',
        '\\.expo',
        'android',
        'ios',
        '__tests__',
        '\\.test\\.tsx?$',
        '\\.d\\.ts$',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: {
        theme: {
          graph: {
            splines: 'ortho',
          },
        },
      },
      archi: {
        collapsePattern: '^src/[^/]+',
      },
    },
  },
};
