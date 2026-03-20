#!/usr/bin/env npx ts-node
/**
 * Pattern Extraction Tool
 *
 * Analyzes golden templates and extracts common patterns:
 * - Entity patterns (person, transaction, appointment, etc.)
 * - Field patterns (name, phone, amount, etc.)
 * - Relationship patterns
 * - Computed field patterns
 *
 * Usage:
 *   npx ts-node tools/extract-patterns.ts
 *
 * Output:
 *   assets/templates/patterns.json
 */

const fs = require('fs');
const path = require('path');

interface TemplateIndex {
  version: number;
  templates: Array<{ id: string; name: string; keywords: string[]; category: string }>;
}

interface KASAppSpec {
  meta: any;
  entities: Array<{
    name: string;
    display_name: string;
    icon: string;
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      searchable: boolean;
    }>;
    relationships: Array<{
      target: string;
      type: string;
      foreign_key: string;
    }>;
  }>;
  computed_fields: Record<string, Array<{ name: string; type: string; source_entity?: string }>>;
  business_rules: Array<{ id: string; entity: string; condition: { type: string } }>;
}

interface EntityPattern {
  name: string;
  common_fields: Array<{
    name: string;
    type: string;
    typically_required: boolean;
    typically_searchable: boolean;
  }>;
  common_relationships: Array<{
    semantic: string;
    type: string;
    fk_pattern: string;
  }>;
  examples: string[];
}

interface FieldPattern {
  name: string;
  type: string;
  typically_required: boolean;
  typically_searchable: boolean;
  occurrences: number;
}

interface ComputedPattern {
  name: string;
  type: string;
  requires: {
    source_entity?: boolean;
    source_field?: boolean;
    date_field?: boolean;
    formula?: boolean;
  };
  occurrences: number;
}

interface PatternDictionary {
  version: number;
  extracted_from: string[];
  entity_patterns: EntityPattern[];
  field_patterns: FieldPattern[];
  computed_patterns: ComputedPattern[];
  rule_patterns: Array<{
    category: string;
    condition_type: string;
    occurrences: number;
  }>;
}

const TEMPLATES_DIR = path.resolve(__dirname, '../assets/templates');
const OUTPUT_FILE = path.join(TEMPLATES_DIR, 'patterns.json');

/**
 * Load all templates from the index.
 */
function loadTemplates(): { id: string; spec: KASAppSpec }[] {
  const indexPath = path.join(TEMPLATES_DIR, 'index.json');
  const index: TemplateIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

  const templates: { id: string; spec: KASAppSpec }[] = [];

  for (const template of index.templates) {
    const specPath = path.join(TEMPLATES_DIR, `${template.id}.json`);
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8')) as KASAppSpec;
      templates.push({ id: template.id, spec });
    } else {
      console.warn(`Template file not found: ${specPath}`);
    }
  }

  return templates;
}

/**
 * Categorize an entity name into a semantic pattern.
 */
function categorizeEntity(name: string): string {
  const nameLower = name.toLowerCase();

  // Person-like entities
  if (['student', 'customer', 'patient', 'client', 'user', 'member'].some(p => nameLower.includes(p))) {
    return 'person';
  }

  // Transaction-like entities
  if (['payment', 'transaction', 'sale', 'purchase', 'order'].some(p => nameLower.includes(p))) {
    return 'transaction';
  }

  // Appointment-like entities
  if (['appointment', 'class', 'session', 'booking', 'meeting'].some(p => nameLower.includes(p))) {
    return 'appointment';
  }

  // Document-like entities
  if (['note', 'prescription', 'document', 'record', 'log'].some(p => nameLower.includes(p))) {
    return 'document';
  }

  // Product-like entities
  if (['product', 'item', 'inventory', 'stock'].some(p => nameLower.includes(p))) {
    return 'product';
  }

  return 'other';
}

/**
 * Extract patterns from templates.
 */
function extractPatterns(templates: { id: string; spec: KASAppSpec }[]): PatternDictionary {
  const fieldCounts: Map<string, { type: string; required: number; searchable: number; total: number }> = new Map();
  const entityPatterns: Map<string, EntityPattern> = new Map();
  const computedCounts: Map<string, ComputedPattern> = new Map();
  const ruleCounts: Map<string, { category: string; type: string; count: number }> = new Map();

  for (const { id, spec } of templates) {
    // Process entities
    for (const entity of spec.entities) {
      const category = categorizeEntity(entity.name);

      if (!entityPatterns.has(category)) {
        entityPatterns.set(category, {
          name: category,
          common_fields: [],
          common_relationships: [],
          examples: [],
        });
      }

      const pattern = entityPatterns.get(category)!;
      if (!pattern.examples.includes(entity.name)) {
        pattern.examples.push(entity.name);
      }

      // Count fields
      for (const field of entity.fields) {
        // Skip FK fields (they're captured in relationships)
        if (field.name.endsWith('_id')) continue;

        const key = `${field.name}:${field.type}`;
        const existing = fieldCounts.get(key) || { type: field.type, required: 0, searchable: 0, total: 0 };
        existing.total++;
        if (field.required) existing.required++;
        if (field.searchable) existing.searchable++;
        fieldCounts.set(key, existing);
      }

      // Count relationships
      for (const rel of entity.relationships) {
        const relKey = `${rel.type}:${rel.foreign_key.replace(/_id$/, '')}`;
        // Could add relationship counting here
      }
    }

    // Process computed fields
    for (const [_entityName, fields] of Object.entries(spec.computed_fields)) {
      for (const field of fields) {
        const key = `${field.type}:${field.name}`;
        if (!computedCounts.has(key)) {
          computedCounts.set(key, {
            name: field.name,
            type: field.type,
            requires: {
              source_entity: !!field.source_entity,
            },
            occurrences: 0,
          });
        }
        computedCounts.get(key)!.occurrences++;
      }
    }

    // Process business rules
    for (const rule of spec.business_rules) {
      const key = `${rule.entity}:${rule.condition.type}`;
      if (!ruleCounts.has(key)) {
        ruleCounts.set(key, {
          category: categorizeEntity(rule.entity),
          type: rule.condition.type,
          count: 0,
        });
      }
      ruleCounts.get(key)!.count++;
    }
  }

  // Convert to output format
  const fieldPatterns: FieldPattern[] = Array.from(fieldCounts.entries())
    .map(([key, data]) => {
      const [name] = key.split(':');
      return {
        name,
        type: data.type,
        typically_required: data.required / data.total > 0.5,
        typically_searchable: data.searchable / data.total > 0.5,
        occurrences: data.total,
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20); // Top 20 patterns

  const computedPatterns: ComputedPattern[] = Array.from(computedCounts.values())
    .sort((a, b) => b.occurrences - a.occurrences);

  const rulePatterns = Array.from(ruleCounts.values())
    .map(r => ({
      category: r.category,
      condition_type: r.type,
      occurrences: r.count,
    }));

  return {
    version: 1,
    extracted_from: templates.map(t => t.id),
    entity_patterns: Array.from(entityPatterns.values()),
    field_patterns: fieldPatterns,
    computed_patterns: computedPatterns,
    rule_patterns: rulePatterns,
  };
}

/**
 * Main entry point.
 */
function main() {
  console.log('Extracting patterns from templates...\n');

  const templates = loadTemplates();
  console.log(`Loaded ${templates.length} templates: ${templates.map(t => t.id).join(', ')}`);

  const patterns = extractPatterns(templates);

  console.log('\nExtracted patterns:');
  console.log(`  - ${patterns.entity_patterns.length} entity patterns`);
  console.log(`  - ${patterns.field_patterns.length} field patterns`);
  console.log(`  - ${patterns.computed_patterns.length} computed patterns`);
  console.log(`  - ${patterns.rule_patterns.length} rule patterns`);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(patterns, null, 2));
  console.log(`\nWritten to: ${OUTPUT_FILE}`);
}

main();
