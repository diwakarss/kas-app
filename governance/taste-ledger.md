# Taste Ledger — KAS App Governance

**Purpose:** Track design review comments that should be promoted to automated tooling.

When a reviewer makes the same observation 3+ times, it becomes a candidate for:
1. ESLint rule addition
2. Prettier config update
3. Constitution file amendment
4. Test case addition

---

## Ledger Format

| ID | Pattern | Times Seen | First Seen | Status | Promoted To |
|----|---------|------------|------------|--------|-------------|
| T001 | Example: "Use `bloom` not `green` for positive states" | 0 | - | Pending | - |

---

## Active Observations

*No observations yet. This ledger will be populated during code review.*

### How to Add Entries

When you notice a repeated correction during `/review` or `/design-review`:

1. Check if the pattern already exists in the ledger
2. If yes, increment "Times Seen"
3. If no, add a new row with Times Seen = 1
4. When Times Seen reaches 3, mark for promotion discussion

---

## Promotion Workflow

### 1. Identification (Times Seen = 3)
```
Pattern observed 3 times → Add to promotion queue
```

### 2. Triage
- **Automatable?** → Create ESLint rule or Prettier config
- **Constitution-level?** → Propose amendment to relevant YAML
- **Test gap?** → Add test case
- **Documentation gap?** → Update DESIGN.md or CLAUDE.md

### 3. Implementation
- Create PR with the automation
- Reference Taste Ledger ID in commit message
- Update Status to "Promoted"
- Fill in "Promoted To" column

### 4. Verification
- Run `/review` on existing code
- Confirm automation catches the pattern
- Close the taste ledger entry

---

## Categories

### Visual Consistency
Patterns related to colors, spacing, typography, component styling.

### Code Quality
Patterns related to naming, structure, error handling, types.

### Performance
Patterns related to render optimization, bundle size, memory usage.

### Accessibility
Patterns related to a11y compliance, screen reader support, focus management.

### Security
Patterns related to input validation, XSS prevention, data handling.

---

## Archived Promotions

*Entries that have been successfully promoted to tooling.*

| ID | Pattern | Promoted To | Date | PR |
|----|---------|-------------|------|-----|
| - | - | - | - | - |

---

## Notes

- This ledger is maintained manually during reviews
- Review it weekly during retrospectives
- Prioritize promotions that save the most review time
- Not all patterns need automation — some are judgment calls

---

*Created: 2026-03-19*
*Last Updated: 2026-03-19*
