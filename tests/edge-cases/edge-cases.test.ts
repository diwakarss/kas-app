/**
 * Edge case tests for Phase D requirements.
 * Tests null handling, empty data, broken references, and invalid inputs.
 */

import { resolveTemplate } from '../../src/engines/template-engine';
import { evaluateComputedFields } from '../../src/engines/computed-field-engine';
import { evaluateRules, filterWarningsByLocation } from '../../src/engines/business-rules-engine';
import { generateDDL } from '../../src/engines/schema-engine';

describe('Edge Cases', () => {
  describe('Template Engine — null/missing fields', () => {
    it('should handle null field values gracefully', () => {
      const result = resolveTemplate('{name} - {phone}', { name: 'Alice', phone: null });
      // Should not crash, should show empty or placeholder for null
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should handle missing field references', () => {
      const result = resolveTemplate('{name} - {nonexistent}', { name: 'Alice' });
      expect(result).toBeDefined();
      expect(result).toContain('Alice');
    });

    it('should handle empty template string', () => {
      const result = resolveTemplate('', { name: 'Alice' });
      expect(result).toBe('');
    });

    it('should handle empty data object', () => {
      const result = resolveTemplate('{name}', {});
      expect(result).toBeDefined();
    });

    it('should handle related entity references when related data is missing', () => {
      const result = resolveTemplate('{student.name}', { id: 1 }, {});
      expect(result).toBeDefined();
    });

    it('should handle related entity with null fields', () => {
      const result = resolveTemplate('{student.name}', { id: 1 }, { student: { name: null } });
      expect(result).toBeDefined();
    });
  });

  describe('Computed Field Engine — edge cases', () => {
    const minimalSpec = {
      meta: {} as any,
      entities: [
        {
          name: 'Student',
          display_name: 'Student',
          display_name_plural: 'Students',
          icon: 'user',
          fields: [{ name: 'name', display_name: 'Name', type: 'text' as const, required: false, searchable: false }],
          relationships: [],
        },
      ],
      anchor: {} as any,
      story_events: {},
      add_flows: {},
      search: { entities: [], display: {} },
      calendar: {} as any,
      chat_commands: [],
      business_rules: [],
      computed_fields: {
        Student: [
          {
            name: 'total_classes',
            display_name: 'Total Classes',
            type: 'count' as const,
            source_entity: 'Class',
            relationship: 'student_id',
          },
        ],
      },
    };

    // Mock db that returns empty results
    const emptyDb = {
      execRaw: () => {},
      run: () => ({ lastInsertRowId: 0, changes: 0 }),
      getAll: () => [],
      getFirst: () => null,
      transaction: (fn: () => void) => fn(),
    };

    it('should handle entity with no computed fields', () => {
      const spec = {
        ...minimalSpec,
        computed_fields: { Student: [] },
      };
      const result = evaluateComputedFields('Student', 1, spec as any, emptyDb as any, { id: 1, name: 'Test' });
      expect(result).toEqual({});
    });

    it('should handle unknown entity type', () => {
      const result = evaluateComputedFields('NonExistent', 1, minimalSpec as any, emptyDb as any, { id: 1 });
      expect(result).toEqual({});
    });

    it('should handle null entity data', () => {
      // Should not crash even with sparse data
      const result = evaluateComputedFields('Student', 1, minimalSpec as any, emptyDb as any, { id: 1 });
      expect(result).toBeDefined();
      expect(typeof result.total_classes).toBe('number');
    });

    it('should return 0 for count when source table has no matching records', () => {
      const result = evaluateComputedFields('Student', 999, minimalSpec as any, emptyDb as any, { id: 999, name: 'Ghost' });
      expect(result.total_classes).toBe(0);
    });
  });

  describe('Business Rules Engine — edge cases', () => {
    it('should return empty array when no rules match entity type', () => {
      const spec = {
        meta: {} as any,
        entities: [],
        anchor: {} as any,
        story_events: {},
        add_flows: {},
        search: { entities: [], display: {} },
        calendar: {} as any,
        chat_commands: [],
        business_rules: [],
        computed_fields: {},
      };
      const result = evaluateRules('Student', { id: 1 }, {}, spec as any, {});
      expect(result).toEqual([]);
    });

    it('should handle entity data with all null fields', () => {
      const spec = {
        meta: {} as any,
        entities: [
          {
            name: 'Student',
            display_name: 'Student',
            display_name_plural: 'Students',
            icon: 'user',
            fields: [],
            relationships: [],
          },
        ],
        anchor: {} as any,
        story_events: {},
        add_flows: {},
        search: { entities: [], display: {} },
        calendar: {} as any,
        chat_commands: [],
        business_rules: [
          {
            id: 'rule_balance',
            name: 'Balance Warning',
            entity: 'Student',
            condition: { type: 'computed_field_exceeds' as const, field: 'balance', value: 0 },
            warning: {
              message: 'Has balance',
              severity: 'warning' as const,
              show_in: ['card'],
            },
          },
        ],
        computed_fields: {},
      };
      const result = evaluateRules('Student', { id: 1, balance: null }, { balance: null }, spec as any, {});
      // null > 0 should be false, so no warning
      expect(result).toEqual([]);
    });

    it('should filter warnings by location correctly', () => {
      const warnings = [
        { ruleId: 'r1', message: 'Card warning', severity: 'warning' as const, showIn: ['card'] },
        { ruleId: 'r2', message: 'Story warning', severity: 'warning' as const, showIn: ['story'] },
        { ruleId: 'r3', message: 'Both warning', severity: 'warning' as const, showIn: ['card', 'story'] },
      ];
      const cardWarnings = filterWarningsByLocation(warnings, 'card');
      expect(cardWarnings).toHaveLength(2);
      expect(cardWarnings.map(w => w.message)).toContain('Card warning');
      expect(cardWarnings.map(w => w.message)).toContain('Both warning');
    });
  });

  describe('Schema Engine — edge cases', () => {
    it('should generate DDL for entity with no fields (only system columns)', () => {
      const spec = {
        meta: {} as any,
        entities: [
          {
            name: 'Empty',
            display_name: 'Empty',
            display_name_plural: 'Empties',
            icon: 'box',
            fields: [],
            relationships: [],
          },
        ],
        anchor: {} as any,
        story_events: {},
        add_flows: {},
        search: { entities: [], display: {} },
        calendar: {} as any,
        chat_commands: [],
        business_rules: [],
        computed_fields: {},
      };
      const ddl = generateDDL(spec as any);
      expect(ddl.length).toBeGreaterThan(0);
      // Should still create the table with system columns
      expect(ddl[0]).toContain('CREATE TABLE');
      expect(ddl[0]).toContain('id INTEGER PRIMARY KEY');
    });

    it('should handle entity with all field types', () => {
      const spec = {
        meta: {} as any,
        entities: [
          {
            name: 'AllTypes',
            display_name: 'All Types',
            display_name_plural: 'All Types',
            icon: 'box',
            fields: [
              { name: 'f_text', display_name: 'Text', type: 'text' as const, required: true, searchable: true },
              { name: 'f_number', display_name: 'Number', type: 'number' as const, required: false, searchable: false },
              { name: 'f_currency', display_name: 'Currency', type: 'currency' as const, required: false, searchable: false },
              { name: 'f_date', display_name: 'Date', type: 'date' as const, required: false, searchable: false },
              { name: 'f_datetime', display_name: 'DateTime', type: 'datetime' as const, required: false, searchable: false },
              { name: 'f_toggle', display_name: 'Toggle', type: 'toggle' as const, required: false, searchable: false },
              { name: 'f_choice', display_name: 'Choice', type: 'choice' as const, required: false, searchable: true, options: ['A', 'B'] },
              { name: 'f_phone', display_name: 'Phone', type: 'phone' as const, required: false, searchable: true },
              { name: 'f_email', display_name: 'Email', type: 'email' as const, required: false, searchable: false },
              { name: 'f_note', display_name: 'Note', type: 'note' as const, required: false, searchable: true },
              { name: 'f_duration', display_name: 'Duration', type: 'duration' as const, required: false, searchable: false },
              { name: 'f_image', display_name: 'Image', type: 'image' as const, required: false, searchable: false },
              { name: 'f_time', display_name: 'Time', type: 'time' as const, required: false, searchable: false },
            ],
            relationships: [],
          },
        ],
        anchor: {} as any,
        story_events: {},
        add_flows: {},
        search: { entities: [], display: {} },
        calendar: {} as any,
        chat_commands: [],
        business_rules: [],
        computed_fields: {},
      };
      const ddl = generateDDL(spec as any);
      expect(ddl.length).toBeGreaterThan(0);
      // Should have an FTS5 table for searchable fields
      const ftsStmt = ddl.find(s => s.includes('fts5'));
      expect(ftsStmt).toBeDefined();
    });
  });
});
