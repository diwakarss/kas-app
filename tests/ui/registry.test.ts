/**
 * Registry Tests
 *
 * Verifies that the registry maps all catalog components to implementations
 * and that no catalog component is missing from the registry.
 */

import { kasComponentNames, kasActionNames } from '../../src/ui/catalog';

// Mock all component imports to avoid React Native dependency chains.
// The registry test verifies structure, not rendering.
const mockComponent = (name: string) => {
  const comp = (props: any) => null;
  comp.displayName = name;
  return comp;
};

jest.mock('../../src/components/EntityCard', () => ({ __esModule: true, default: mockComponent('EntityCard') }));
jest.mock('../../src/components/Greeting', () => ({ __esModule: true, default: mockComponent('Greeting') }));
jest.mock('../../src/components/EmptyState', () => ({ __esModule: true, default: mockComponent('EmptyState') }));
jest.mock('../../src/components/TimelineEvent', () => ({ __esModule: true, default: mockComponent('TimelineEvent') }));
jest.mock('../../src/components/StatsCard', () => ({ __esModule: true, default: mockComponent('StatsCard') }));
jest.mock('../../src/components/SummaryStats', () => ({ __esModule: true, default: mockComponent('SummaryStats') }));
jest.mock('../../src/components/ComingUpCard', () => ({ __esModule: true, default: mockComponent('ComingUpCard') }));
jest.mock('../../src/components/WarningBadge', () => ({ __esModule: true, default: mockComponent('WarningBadge') }));
jest.mock('../../src/components/FloatingActions', () => ({ __esModule: true, default: mockComponent('FloatingActions') }));
jest.mock('../../src/components/FieldRenderer', () => ({ __esModule: true, default: mockComponent('FieldRenderer') }));
jest.mock('../../src/components/SectionHeader', () => ({ __esModule: true, default: mockComponent('SectionHeader') }));
jest.mock('../../src/components/MonthGrid', () => ({ __esModule: true, default: mockComponent('MonthGrid') }));
jest.mock('../../src/components/DayDetail', () => ({ __esModule: true, default: mockComponent('DayDetail') }));
jest.mock('../../src/components/StepProgress', () => ({ __esModule: true, default: mockComponent('StepProgress') }));

describe('KAS Registry', () => {
  let registry: Record<string, unknown>;
  let registryModule: any;

  beforeAll(() => {
    // Import the registry module — this verifies all component imports resolve
    registryModule = require('../../src/ui/registry');
    registry = registryModule.registry;
  });

  test('registry exports a registry object', () => {
    expect(registry).toBeDefined();
    expect(typeof registry).toBe('object');
  });

  test('registry contains all KAS custom components', () => {
    for (const name of kasComponentNames) {
      expect(registry[name]).toBeDefined();
    }
  });

  test('registry exports handlers function', () => {
    expect(registryModule.handlers).toBeDefined();
    expect(typeof registryModule.handlers).toBe('function');
  });

  test('registry exports executeAction function', () => {
    expect(registryModule.executeAction).toBeDefined();
    expect(typeof registryModule.executeAction).toBe('function');
  });
});
