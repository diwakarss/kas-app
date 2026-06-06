/**
 * Spec Library Service
 *
 * Manages the template library:
 * - Loads templates from assets/templates/
 * - Provides template lookup by ID
 * - Returns template metadata for matching
 */

import type { KASAppSpec } from "../../core/types/spec";
import type { TemplateRegistry, TemplateMetadata } from "../types/generation";

// Template index loaded at module initialization
let templateRegistry: TemplateRegistry | null = null;
let templateCache: Map<string, KASAppSpec> = new Map();

/**
 * Load the template registry from index.json.
 * Called once at startup or first access.
 */
function loadRegistry(): TemplateRegistry {
  if (templateRegistry) return templateRegistry;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const index = require("../../../assets/templates/index.json");
    templateRegistry = index as TemplateRegistry;
    return templateRegistry;
  } catch (error: any) {
    console.error(
      "[SpecLibrary] Failed to load template index:",
      error.message,
    );
    // Return empty registry as fallback
    templateRegistry = { version: 0, templates: [] };
    return templateRegistry;
  }
}

/**
 * Load a template spec by ID.
 * Caches loaded templates in memory.
 */
function loadTemplate(templateId: string): KASAppSpec | null {
  // Check cache first
  if (templateCache.has(templateId)) {
    return templateCache.get(templateId)!;
  }

  try {
    // Dynamic require based on template ID
    // Note: In production, this would use a more robust loading mechanism
    let spec: KASAppSpec;
    switch (templateId) {
      case "tutor":
        spec = require("../../../assets/templates/tutor.json");
        break;
      case "shopkeeper":
        spec = require("../../../assets/templates/shopkeeper.json");
        break;
      case "doctor":
        spec = require("../../../assets/templates/doctor.json");
        break;
      default:
        if (process.env.NODE_ENV !== "test") {
          console.warn(`[SpecLibrary] Unknown template: ${templateId}`);
        }
        return null;
    }

    templateCache.set(templateId, spec);
    return spec;
  } catch (error: any) {
    console.error(
      `[SpecLibrary] Failed to load template ${templateId}:`,
      error.message,
    );
    return null;
  }
}

/**
 * Spec Library Service
 */
export const SpecLibrary = {
  /**
   * Get all available templates.
   */
  listTemplates(): TemplateMetadata[] {
    const registry = loadRegistry();
    return registry.templates;
  },

  /**
   * Get a template by ID.
   * Returns null if template not found.
   */
  getTemplate(templateId: string): KASAppSpec | null {
    const registry = loadRegistry();
    const metadata = registry.templates.find((t) => t.id === templateId);

    if (!metadata) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[SpecLibrary] Template not in registry: ${templateId}`);
      }
      return null;
    }

    return loadTemplate(templateId);
  },

  /**
   * Get template metadata by ID.
   */
  getTemplateMetadata(templateId: string): TemplateMetadata | null {
    const registry = loadRegistry();
    return registry.templates.find((t) => t.id === templateId) || null;
  },

  /**
   * Check if a template exists.
   */
  hasTemplate(templateId: string): boolean {
    const registry = loadRegistry();
    return registry.templates.some((t) => t.id === templateId);
  },

  /**
   * Get templates by category.
   */
  getTemplatesByCategory(category: string): TemplateMetadata[] {
    const registry = loadRegistry();
    return registry.templates.filter((t) => t.category === category);
  },

  /**
   * Search templates by keyword.
   * Returns templates whose keywords include the search term.
   */
  searchTemplates(keyword: string): TemplateMetadata[] {
    const registry = loadRegistry();
    const normalizedKeyword = keyword.toLowerCase().trim();

    return registry.templates.filter(
      (t) =>
        t.keywords.some((k) => k.toLowerCase().includes(normalizedKeyword)) ||
        t.name.toLowerCase().includes(normalizedKeyword) ||
        t.description.toLowerCase().includes(normalizedKeyword),
    );
  },

  /**
   * Clear the template cache.
   * Useful for testing or hot-reloading.
   */
  clearCache(): void {
    templateCache.clear();
    templateRegistry = null;
  },

  /**
   * Get the registry version.
   */
  getVersion(): number {
    const registry = loadRegistry();
    return registry.version;
  },
};

export type { TemplateMetadata, TemplateRegistry };
