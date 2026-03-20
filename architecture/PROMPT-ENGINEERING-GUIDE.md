# Prompt Engineering Guide for Template Authors

**Created:** 2026-03-20
**Purpose:** Guidelines for writing prompts that generate high-quality app specs
**Audience:** Contributors adding new business type templates or modifying generation prompts

---

## Overview

The KAS App Builder uses LLM-powered spec generation for unknown business types. This guide documents the prompt structure, best practices, and testing approaches for maintaining generation quality.

---

## System Prompt Architecture

The generation system uses a two-part prompt structure:

### 1. System Prompt (Static)

Located in: `src/generation/services/llm-adaptation.ts`

```
SPEC_GENERATION_SYSTEM_PROMPT
```

**Purpose:** Establishes output format, field types, and structural requirements.

**Key Components:**
- `/no_think` directive (suppresses reasoning for JSON-only output)
- Complete schema example with all required sections
- Field type reference list
- Critical rules for common failure modes

### 2. User Prompt (Dynamic)

Built by: `buildGenerationPrompt(businessType, businessName, features?)`

**Purpose:** Provides business-specific context and requirements.

---

## Prompt Engineering Rules

### Rule 1: Be Explicit About Structure

LLMs produce better JSON when given explicit examples.

```
GOOD:
"entities": [
  {
    "name": "Customer",
    "display_name": "Customer",
    ...
  }
]

BAD:
"Create entities with appropriate fields"
```

### Rule 2: Use Negative Examples for Common Failures

Document what NOT to do when failure patterns emerge.

```
CRITICAL: add_flows steps use "field" (singular), NOT "fields" array.
CRITICAL: story_events MUST exist for entities that are belongs_to targets.
```

### Rule 3: Temperature Selection

| Use Case | Temperature | Reason |
|----------|-------------|--------|
| Fresh generation | 0.7 | Creative diversity for new templates |
| Spec modification | 0.5 | Preserve existing structure |
| Field type inference | 0.3 | Deterministic choices |

### Rule 4: Stop Sequences

Use stop sequences to prevent runaway generation:

```typescript
stop: ['```\n\n']  // Stop after JSON code block closes
```

### Rule 5: Token Budgets

| Operation | Max Tokens | Reason |
|-----------|------------|--------|
| Fresh generation | 8192 | Full spec is ~4000 tokens |
| Modification | 8192 | Must return complete spec |
| Entity addition | 2048 | Single entity ~500 tokens |

---

## Field Type Reference

Document these types in system prompt for consistent generation:

| Type | Description | Example |
|------|-------------|---------|
| `text` | Plain text | name, title |
| `number` | Numeric value | quantity, age |
| `currency` | Money amount | price, payment |
| `phone` | Phone number | mobile, office |
| `email` | Email address | email |
| `choice` | Fixed options | status, category |
| `date` | Date only | birthday, due_date |
| `datetime` | Date and time | appointment, class_time |
| `time` | Time only | opening_hours |
| `toggle` | Boolean | is_active, paid |
| `duration` | Time span | class_length |
| `note` | Long text | description, notes |
| `image` | Image file | photo, logo |

---

## Relationship Patterns

### belongs_to (Most Common)

Child entity references parent via foreign key.

```json
{
  "name": "Appointment",
  "relationships": [
    {
      "target": "Customer",
      "type": "belongs_to",
      "foreign_key": "customer_id",
      "display_in_story": true
    }
  ]
}
```

### has_many (Derived)

Parent entity implicitly has many children. Do NOT define explicitly in spec.

---

## Common Failure Modes

### 1. Missing story_events

**Symptom:** Story screen crashes for related entities

**Prevention:** Add to system prompt:
```
CRITICAL: story_events MUST exist for entities that are belongs_to targets
```

### 2. Array vs Single Field in add_flows

**Symptom:** Add flow doesn't render fields correctly

**Prevention:** Add to system prompt:
```
CRITICAL: add_flows steps use "field" (singular), NOT "fields" array
```

### 3. Missing Display Templates

**Symptom:** Search results show [object Object]

**Prevention:** Require explicit display templates:
```
search.display.Customer = "{name} - {phone}"
calendar.display = "{time} - {customer.name}"
```

### 4. Invalid Field References

**Symptom:** Template interpolation fails

**Prevention:** Validate field references exist in entity definition

---

## Testing New Prompts

### Unit Test Structure

For each prompt change, create test cases in `tests/generation/`:

```typescript
describe('Prompt: [change description]', () => {
  it('should generate valid spec for [business type]', async () => {
    const result = await generator.generate('boutique', { name: 'Test' });
    expect(result.success).toBe(true);
  });

  it('should include required sections', async () => {
    // Validate all sections present
  });

  it('should handle edge case: [description]', async () => {
    // Test specific failure mode
  });
});
```

### Golden Evaluation Set

Location: `assets/golden-eval/`

**Purpose:** Regression testing across business types

**Structure:**
```
golden-eval/
  tutor.expected.json      # Expected output for tutor
  shopkeeper.expected.json # Expected output for shopkeeper
  doctor.expected.json     # Expected output for doctor
  restaurant.expected.json # Expected output for restaurant
```

**Evaluation Metrics:**
- Structural validity (all required sections)
- Field type consistency
- Relationship integrity
- Template interpolation validity

---

## Adding a New Template

### Step 1: Create Template File

```
assets/templates/[business-type].json
```

### Step 2: Add to Index

```json
// assets/templates/index.json
{
  "[business-type]": {
    "path": "[business-type].json",
    "category": "[category]",
    "description": "[description]"
  }
}
```

### Step 3: Add Category Mapping

```typescript
// src/generation/services/category-matcher.ts
const KNOWN_TYPES = [
  // ... existing types
  'your-new-type',
];
```

### Step 4: Create Tests

```typescript
// tests/generation/templates/[business-type].test.ts
describe('[BusinessType] Template', () => {
  it('should load from library', () => {
    const spec = library.loadTemplate('[business-type]');
    expect(spec).toBeDefined();
  });
});
```

### Step 5: Add Golden Evaluation

```
assets/golden-eval/[business-type].expected.json
```

---

## Model-Specific Notes

### Qwen 2.5-72B

- Use `/no_think` directive to suppress `<think>` tags
- Handle unclosed `<think>` tags in response parsing
- Max context: 32K tokens
- Good at JSON structure but needs explicit examples

### OpenAI GPT-4

- No special directives needed
- Better at inference from natural language
- More expensive per token
- Use for fallback or testing

### DeepInfra

- OpenAI-compatible API
- Hosts Qwen models
- Use `DEEPINFRA_API_KEY` environment variable

---

## Debugging Generation Failures

### 1. Enable Verbose Logging

```typescript
// Temporary: log raw LLM response
console.log('[DEBUG] Raw response:', result.text);
```

### 2. Test JSON Extraction

```typescript
import { extractJSON } from '../services/llm-adaptation';

const raw = result.text;
const json = extractJSON(raw);
console.log('[DEBUG] Extracted JSON:', json);
```

### 3. Validate Incrementally

```typescript
const spec = parseResponse(result.text);
console.log('[DEBUG] Parsed spec sections:', Object.keys(spec));

const validation = SpecValidator.validate(spec);
console.log('[DEBUG] Validation errors:', getAllErrors(validation));
```

### 4. Compare Against Golden Template

Diff generated spec against known-good template to identify structural issues.

---

## Prompt Evolution Process

1. **Identify Failure:** Document specific failure mode
2. **Add Test:** Create failing test case
3. **Update Prompt:** Add explicit rule or example
4. **Verify Fix:** Ensure test passes
5. **Regression Test:** Run full golden eval suite
6. **Document:** Update this guide with new pattern

---

*This guide satisfies the Prompt Engineering Guidelines TODO from TODOS.md*
