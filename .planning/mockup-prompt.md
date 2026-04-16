# Mockup Generator Prompt Constraints

Used when generating home-screen mockups (gpt-image-1) for design review.
Captures the lessons from the 2026-04-17 mockup round, where the model
invented details the runtime doesn't produce (dark themes, dog portraits,
stat labels that didn't exist in code).

## Base prompt (copy verbatim)

> Render a mobile app home screen for **\[business name]** — the anchor
> screen of a generated KAS app. Show the exact components and data
> below. Do **not** invent features or decorations.
>
> **Visual style:**
>
> - Light theme only. Background **#FAF7F2** (dawn / warm cream). Never
>   dark mode, never navy / graphite / black.
> - All text in **Inter**. Heading 20px semibold, body 14px regular,
>   metadata 13px regular, action 14px medium.
> - Palette: primary text **#3D3530** (clay), secondary **#B8AFA6** (mist),
>   accent **#5B8BA4** (stream), success **#6B9E78** (bloom),
>   urgent **#D4845A** (ember). No other colors, no gradients.
> - Card: white `#FFFFFF`, 16px corner radius, 16px padding, 20px horizontal
>   margin, 12px gap between cards. Shadow: `0 2px 8px rgba(61,53,48,0.08)`.
>   No borders.
> - No illustrations, no stock photography, no cartoon characters,
>   no floral / decorative icons. Brand lockups and emoji entity icons
>   (👤, 🎓, 🐶, etc.) are OK when paired with a text label.
>
> **Layout (top to bottom):**
>
> 1. Greeting header: "Good \[morning|afternoon|evening], \[business name]".
>    Below: date label (e.g. "Today") + optional "Next: \[title] · \[time]"
>    line in stream color.
> 2. SummaryStats card: horizontal row of 2–3 stats. Each stat shows
>    **value on top (text-2xl clay, semibold)** and **label below
>    (text-xs mist)**. Optional trend chip ("▲ +12%" bloom / "▼ -3%" ember
>    / "• no change" mist) under the label. Stats are label-first only
>    if the component renders a label — here it does.
> 3. Card list: 2 to 4 EntityCard rows. Each card shows title (text-base
>    clay semibold, one line), subtitle (text-sm mist, one line),
>    and a time on the right (text-sm stream medium). Optional
>    ember warning chip below when the record has a warning.
> 4. Bottom bar: 4 items (🔍 Search, 📅 Calendar, + FAB in stream, 💬 Chat).
>    FAB is the only colored control on the bar.
>
> **Hard constraints:**
>
> - Render labels **only if the component renders them in code**. Bare
>   numbers without labels are a bug to reproduce only when the code ships
>   that way.
> - Sample data: every row has a **different person / pet / item name**.
>   Never the same name 3x.
> - Subtitles prefer descriptive text (notes, reason, topic) over raw
>   dates. If the subtitle template resolves to an ISO date, humanize
>   it ("Today", "Tomorrow", "Apr 18").
> - Time column is never blank. If the date field has no time part,
>   fall back to a day label.
> - On tablet (≥768 px width), cards render in a 2-column grid. On
>   phone (<768 px), single column.
> - Never add features not listed here: no charts, no progress rings,
>   no avatar photos on cards, no map widgets.

## Per-vertical inputs to supply

| Field | Example |
|---|---|
| Business name | "Priya's Music School" |
| Vertical | music-school, cafe, grooming, plumbing … |
| Anchor entity | Class |
| Anchor title template | `{student.name}` |
| Anchor subtitle template | `{topic}` |
| Stats | `Today / This Week / This Month` |
| Sample records (3–4) | distinct names, distinct times |

## Review checklist before accepting a mockup

- [ ] Background is dawn/cream — never dark.
- [ ] Stat labels render in the mockup only if StatsCard / SummaryStats
      renders them in code.
- [ ] Each card shows a distinct name / title.
- [ ] Subtitle is descriptive text, not a raw ISO date.
- [ ] Time column has a value on every row.
- [ ] No invented imagery (pet portraits, nature scenes, stock photos).
- [ ] No icons or glyphs that are not in the runtime component set.

## Related findings

- Design review: `.planning/design-review-2026-04-17.md` (sections
  New-A, New-B, New-E, New-F, 4A).
- Runtime design tokens: `DESIGN.md`, `src/core/theme/tokens.ts`.
