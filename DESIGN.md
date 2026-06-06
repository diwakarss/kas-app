# Design System

Source of truth for colors, typography, spacing, shadows, and radii in the KAS runtime UI.
All tokens live in `src/core/theme/tokens.ts`. When you need a style, import from there before inventing new values.

## Colors

All tokens are designed for a light, warm, low-chroma background with high-contrast text.

| Token    | Hex       | Semantic role                                | On which background |
| -------- | --------- | -------------------------------------------- | ------------------- |
| `dawn`   | `#FAF7F2` | Primary app background (warm cream)          | —                   |
| `dusk`   | `#1A1614` | Reserved for future dark theme; unused today | —                   |
| `clay`   | `#3D3530` | Primary text, headings                       | `dawn`, white cards |
| `mist`   | `#B8AFA6` | Secondary text, labels, inactive state       | `dawn`, white cards |
| `ember`  | `#D4845A` | Warning / urgent accent, primary CTA (FAB)   | `dawn`, white cards |
| `bloom`  | `#6B9E78` | Success / confirm accent                     | `dawn`, white cards |
| `stream` | `#0D47A1` | Link / action / time accent                  | `dawn`, white cards |

Contrast (WCAG AA target `4.5:1` body, `3:1` large):

- `clay` on `dawn` — pass AA body ✅
- `mist` on `dawn` — pass AA large only; **never use for body text**, only for labels ≤13px
- `ember` / `bloom` / `stream` on `dawn` — pass AA large; use for UI accents, not sentences

## Typography

All weights come from the `Inter` family (loaded in `app.config` via Expo fonts).

| Style        | Family              | Size | Token path              | Use                         |
| ------------ | ------------------- | ---- | ----------------------- | --------------------------- |
| `heading`    | `Inter_600SemiBold` | 20   | `typography.heading`    | Screen headers, greeting    |
| `subheading` | `Inter_500Medium`   | 16   | `typography.subheading` | Section titles, card titles |
| `body`       | `Inter_400Regular`  | 14   | `typography.body`       | Paragraph text              |
| `secondary`  | `Inter_400Regular`  | 13   | `typography.secondary`  | Card subtitles, metadata    |
| `action`     | `Inter_500Medium`   | 14   | `typography.action`     | Links, time, button labels  |
| `warning`    | `Inter_500Medium`   | 13   | `typography.warning`    | Warning badges              |

NativeWind utility equivalents (kept in sync by convention — when adding a new size, add it to both):

- `font-inter` → Inter_400Regular
- `font-inter-medium` → Inter_500Medium
- `font-inter-semibold` → Inter_600SemiBold
- `text-xs` 12, `text-sm` 14, `text-base` 16, `text-lg` 18, `text-xl` 20

## Spacing

| Token | px  | Typical use                             |
| ----- | --- | --------------------------------------- |
| `xs`  | 4   | Icon gap, badge inner                   |
| `sm`  | 8   | Row gap, small stack                    |
| `md`  | 16  | Card padding, section padding           |
| `lg`  | 24  | Screen-edge margin (also `mx-5` = 20px) |
| `xl`  | 32  | Section break                           |

## Border radius

| Token  | px   | Use                              |
| ------ | ---- | -------------------------------- |
| `sm`   | 8    | Chips, tags                      |
| `md`   | 12   | Buttons                          |
| `lg`   | 16   | Cards (`rounded-2xl` equivalent) |
| `xl`   | 24   | Modals, sheets                   |
| `pill` | 9999 | Pill buttons, status badges      |

## Shadows

One shared preset — don't reinvent.

- `cardShadow` — `src/core/theme/tokens.ts`. Used by `EntityCard`, `StatsCard`. For any elevated surface on `dawn`/white cards.

```ts
import { cardShadow } from '../core/theme/tokens';

<View style={cardShadow} className="rounded-2xl bg-white p-4" />
```

If you need a stronger shadow (modal, sheet), add a new preset to `tokens.ts` (e.g. `modalShadow`) rather than inlining.

## Component patterns

- **Card** — white background, `rounded-2xl` (16px), `p-4` (16px), `cardShadow`, `mx-5` (20px) screen-edge margin, `mb-3` between cards. See `EntityCard.tsx`.
- **Section header** — `px-5 py-2`, `font-inter-medium text-base text-clay`, optional count chip on the right. See `SectionHeader.tsx`.
- **FAB** — 56px circle, `ember` background, bottom-right, `bottom-24 right-5`. See `FloatingActions.tsx`.
- **Empty state** — centered icon + message + optional primary CTA. See `EmptyState.tsx`.
- **Warning badge** — inline text variant (`WarningTextBadge`) or chip. Color from `severityColors` in `src/core/theme/colors.ts`.

## Emoji and icons

KAS uses emoji for entity categorization (AddMenu rows, FAB toolbar) and avoids icon libraries.
This keeps the bundle small and lets the LLM pick an icon per entity without shipping a fixed set.

**When emoji is OK:**

- Entity-type identifiers (👤 Client, 🎓 Class, 🐶 Pet). Always paired with a text label — never emoji-only.
- FAB toolbar actions (🔍 Search, 📅 Calendar, 💬 Chat). Label + emoji.
- Decorative accents in empty states when the screen also has explanatory text.

**When emoji is NOT OK:**

- Inline status indicators — use colored dots / `WarningBadge` from the palette (`bloom`/`ember`/`stream`).
- Within sentences or body text — emojis break rhythm and don't inherit `clay`/`mist` color.
- Severity or alert markers — use `severityColors` in `src/core/theme/colors.ts`.
- Standalone tap targets without a label — fails accessibility (no text for screen readers).

**Sizing:**

- Toolbar / FAB: `fontSize: 22`
- Entity-row (AddMenu): `fontSize: 24`, `marginRight: 12`

**Picking the emoji:**

- Inference lives in `ICON_MAP` inside `src/generation/services/spec-normalizer.ts`.
  When adding a new domain keyword, pair it with a widely-supported glyph (U+2600 – U+1F9FF).
- Avoid skintone modifiers, gendered people emojis when a neutral version exists, and
  emojis with known cross-platform rendering issues.

## Accessibility

- Every interactive element has `accessibilityRole="button"` (or `link`, `header`) and `accessibilityLabel`.
- Headings use `accessibilityRole="header"` (Greeting, SectionHeader).
- Multi-value components (StatsCard) expose a single combined `accessibilityLabel` so screen readers announce `"Today, 3"` rather than `"3"` alone.
- Touch targets are `≥44×44` points. Card `p-4` + content yields >44; FAB is 56.

## When to add a new token

Add to `tokens.ts` when:

- The same literal value appears in ≥2 components.
- A new semantic role emerges (e.g., a new severity, a second shadow depth).

Do NOT add:

- Single-use values — keep them inline until they repeat.
- Variants of an existing token — edit the token instead of duplicating.

## Cross-references

- Runtime screens: `src/screens/{AnchorScreen,StoryScreen,AddFlowScreen,CalendarScreen}.tsx`
- Shared components: `src/components/`
- Tokens: `src/core/theme/tokens.ts`
- Severity mapping: `src/core/theme/colors.ts`
- Last design review: `.planning/design-review-2026-04-17.md`
