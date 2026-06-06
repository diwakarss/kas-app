/**
 * Tests for the domain-entity injection normalizer.
 */
import { injectMissingDomainEntities } from "../../src/generation/services/normalizers/inject-entities";
import { normalizeEntity } from "../../src/generation/services/normalizers/entity";
import type { Entity } from "../../src/core/types/spec";

function ent(overrides: {
  name: string;
  fields?: any[];
  relationships?: any[];
}): Entity {
  return normalizeEntity({
    name: overrides.name,
    fields: overrides.fields ?? [],
    relationships: overrides.relationships ?? [],
  } as any);
}

describe("injectMissingDomainEntities", () => {
  test("injects Property for cleaning vertical when missing", () => {
    const entities = [
      ent({
        name: "Client",
        fields: [
          { name: "name", type: "text" },
          { name: "email", type: "email" },
        ],
      }),
      ent({
        name: "Job",
        fields: [
          { name: "description", type: "text" },
          { name: "scheduled_at", type: "datetime" },
          { name: "client_id", type: "number" },
        ],
        relationships: [
          {
            target: "Client",
            type: "belongs_to",
            foreign_key: "client_id",
            display_in_story: true,
          },
        ],
      }),
      ent({ name: "Cleaner", fields: [{ name: "name", type: "text" }] }),
    ];
    const out = injectMissingDomainEntities(entities, "Sparkle Homes");
    const property = out.find((e) => e.name === "Property");
    expect(property).toBeDefined();
    expect(property!.fields.some((f) => f.name === "address")).toBe(true);
    expect(property!.relationships.some((r) => r.target === "Client")).toBe(
      true,
    );

    const job = out.find((e) => e.name === "Job")!;
    expect(job.fields.some((f) => f.name === "property_id")).toBe(true);
    expect(
      job.relationships.some(
        (r) => r.target === "Property" && r.foreign_key === "property_id",
      ),
    ).toBe(true);
  });

  test("injects Property using business name hint when entity names lack the keyword", () => {
    const entities = [
      ent({
        name: "Client",
        fields: [
          { name: "name", type: "text" },
          { name: "email", type: "email" },
        ],
      }),
      ent({
        name: "Job",
        fields: [
          { name: "scheduled_at", type: "datetime" },
          { name: "client_id", type: "number" },
        ],
        relationships: [
          {
            target: "Client",
            type: "belongs_to",
            foreign_key: "client_id",
            display_in_story: true,
          },
        ],
      }),
      ent({ name: "Crew", fields: [{ name: "name", type: "text" }] }),
    ];
    const out = injectMissingDomainEntities(entities, "Evergreen Landscapes");
    expect(out.some((e) => e.name === "Property")).toBe(true);
  });

  test("injects Pet for dog-walking vertical", () => {
    const entities = [
      ent({
        name: "Client",
        fields: [
          { name: "name", type: "text" },
          { name: "phone", type: "phone" },
        ],
      }),
      ent({
        name: "Walk",
        fields: [
          { name: "scheduled_time", type: "datetime" },
          { name: "client_id", type: "number" },
        ],
        relationships: [
          {
            target: "Client",
            type: "belongs_to",
            foreign_key: "client_id",
            display_in_story: true,
          },
        ],
      }),
      ent({ name: "Walker", fields: [{ name: "name", type: "text" }] }),
    ];
    const out = injectMissingDomainEntities(entities, "Pawfect Walks");
    const pet = out.find((e) => e.name === "Pet");
    expect(pet).toBeDefined();
    expect(pet!.fields.some((f) => f.name === "species")).toBe(true);

    const walk = out.find((e) => e.name === "Walk")!;
    expect(walk.fields.some((f) => f.name === "pet_id")).toBe(true);
  });

  test("does not inject Property when one already exists (case-insensitive)", () => {
    const entities = [
      ent({
        name: "Client",
        fields: [
          { name: "name", type: "text" },
          { name: "email", type: "email" },
        ],
      }),
      ent({ name: "Property", fields: [{ name: "address", type: "text" }] }),
      ent({
        name: "Job",
        fields: [{ name: "scheduled_at", type: "datetime" }],
      }),
    ];
    const out = injectMissingDomainEntities(entities, "Sparkle Cleaning");
    expect(out.filter((e) => /^property$/i.test(e.name)).length).toBe(1);
  });

  test("does not inject Property for non-dispatch verticals", () => {
    const entities = [
      ent({
        name: "Client",
        fields: [
          { name: "name", type: "text" },
          { name: "email", type: "email" },
        ],
      }),
      ent({
        name: "Appointment",
        fields: [
          { name: "scheduled_at", type: "datetime" },
          { name: "client_id", type: "number" },
        ],
        relationships: [
          {
            target: "Client",
            type: "belongs_to",
            foreign_key: "client_id",
            display_in_story: true,
          },
        ],
      }),
    ];
    const out = injectMissingDomainEntities(entities, "Bright Smile Dental");
    expect(out.some((e) => e.name === "Property")).toBe(false);
    expect(out.some((e) => e.name === "Pet")).toBe(false);
  });

  test("skips when no person-like entity is present", () => {
    const entities = [
      ent({
        name: "Job",
        fields: [{ name: "scheduled_at", type: "datetime" }],
      }),
    ];
    const out = injectMissingDomainEntities(entities, "Cleaning Services");
    expect(out.some((e) => e.name === "Property")).toBe(false);
    expect(out.length).toBe(1);
  });
});
