/**
 * Story Spec Builder Tests
 */

import { buildStorySpec } from "../../../src/ui/spec-builders/story";
import { catalog } from "../../../src/ui/catalog";
import { validateSpec } from "@json-render/core";
import type {
  StoryData,
  TimelineEventData,
} from "../../../src/hooks/useStoryData";

function makeMockEvent(
  overrides: Partial<TimelineEventData> = {},
): TimelineEventData {
  return {
    id: 1,
    sourceEntity: "class",
    eventType: "completed",
    display: "2026-04-15 - Completed - Scales",
    iconColor: "#6B9E78",
    sortDate: "2026-04-15T10:00:00Z",
    rawData: {},
    ...overrides,
  };
}

function makeMockStoryData(overrides: Partial<StoryData> = {}): StoryData {
  return {
    entity: { id: 5, name: "Asha Kumar", grade: "Grade 4" },
    entityType: "Student",
    entityDef: { name: "Student", display_name: "Student", icon: "🎓" },
    statsCard: [
      { label: "Rs.500/hr", value: "Rs.500/hr" },
      { label: "Grade 4", value: "Grade 4" },
    ],
    comingUp: [
      {
        display: "2026-04-17 - Theory",
        id: 10,
        sortDate: "2026-04-17T10:00:00Z",
      },
    ],
    events: [
      makeMockEvent(),
      makeMockEvent({
        id: 2,
        display: "2026-04-14 - Rescheduled",
        iconColor: "#0D47A1",
      }),
    ],
    origin: "Started 2026-01-15 - 12 classes",
    context: "Learning since 2026-01-15",
    warnings: [],
    hasMore: false,
    totalLoaded: 2,
    ...overrides,
  };
}

describe("buildStorySpec", () => {
  test("produces a valid json-render spec", () => {
    const spec = buildStorySpec(makeMockStoryData());
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
  });

  test("passes catalog validation", () => {
    const spec = buildStorySpec(makeMockStoryData());
    const result = catalog.validate(spec);
    expect(result.success).toBe(true);
  });

  test("includes header with entity name", () => {
    const spec = buildStorySpec(makeMockStoryData());
    expect(spec.elements["entity-name"]).toBeDefined();
    expect(spec.elements["entity-name"].props.text).toBe("Asha Kumar");
  });

  test("includes StatsCard", () => {
    const spec = buildStorySpec(makeMockStoryData());
    expect(spec.elements["stats-card"]).toBeDefined();
    expect(spec.elements["stats-card"].type).toBe("StatsCard");
    expect((spec.elements["stats-card"].props as any).items.length).toBe(2);
  });

  test("includes ComingUp section with header", () => {
    const spec = buildStorySpec(makeMockStoryData());
    expect(spec.elements["coming-up-header"]).toBeDefined();
    expect(spec.elements["coming-up-header"].type).toBe("SectionHeader");
    expect(spec.elements["coming-up-0"]).toBeDefined();
    expect(spec.elements["coming-up-0"].type).toBe("ComingUpCard");
  });

  test("includes TimelineEvent elements", () => {
    const spec = buildStorySpec(makeMockStoryData());
    expect(spec.elements["event-0"]).toBeDefined();
    expect(spec.elements["event-0"].type).toBe("TimelineEvent");
    expect(spec.elements["event-1"]).toBeDefined();
    expect(spec.elements["event-1"].props.isLast).toBe(true);
  });

  test("marks last event with isLast=true", () => {
    const spec = buildStorySpec(makeMockStoryData());
    const lastEvent = spec.elements["event-1"];
    expect(lastEvent.props.isLast).toBe(true);
    expect(spec.elements["event-0"].props.isLast).toBe(false);
  });

  test("includes origin footer", () => {
    const spec = buildStorySpec(makeMockStoryData());
    expect(spec.elements["origin"]).toBeDefined();
    expect(spec.elements["origin"].props.text).toContain("Started");
  });

  test("handles empty events gracefully", () => {
    const spec = buildStorySpec(
      makeMockStoryData({ events: [], totalLoaded: 0 }),
    );
    const result = validateSpec(spec);
    expect(result.valid).toBe(true);
    expect(spec.elements["story-header"]).toBeUndefined();
  });

  test("handles empty comingUp gracefully", () => {
    const spec = buildStorySpec(makeMockStoryData({ comingUp: [] }));
    expect(spec.elements["coming-up-section"]).toBeUndefined();
  });

  test("includes warnings when present", () => {
    const spec = buildStorySpec(
      makeMockStoryData({
        warnings: [
          {
            message: "Payment overdue",
            severity: "warning",
            locations: ["story"],
          },
        ] as any,
      }),
    );
    expect(spec.elements["warning-0"]).toBeDefined();
    expect(spec.elements["warning-0"].type).toBe("WarningBadge");
  });

  test("formats datetime DetailRow values to human-readable strings", () => {
    const spec = buildStorySpec(
      makeMockStoryData({
        entity: {
          id: 7,
          schedule: "2026-04-17T03:30:00.000Z",
          status: "Scheduled",
        },
        entityDef: {
          name: "Appointment",
          display_name: "Appointment",
          icon: "📅",
          fields: [
            { name: "schedule", type: "datetime", display_name: "Schedule" },
            { name: "status", type: "choice", display_name: "Status" },
          ],
        } as any,
      }),
    );
    const row = spec.elements["detail-schedule"];
    expect(row).toBeDefined();
    expect(row.props.value).not.toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.props.value).toMatch(/2026|Apr/);
    expect(spec.elements["detail-status"].props.value).toBe("Scheduled");
  });
});
