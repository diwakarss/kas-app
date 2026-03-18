# PeopleNet

Blockchain-based civic technology platform for democratic participation and community governance.

## Project Overview

**Vision:** Decentralized infrastructure for civic engagement that enables transparent, accountable governance at community scale.

**Reference Documentation:**
- `docs/peoplenet-cornerstone/` — Core architecture blueprints (source of truth)
- `docs/peoplenet-pmf/` — Product-market fit research
- `docs/ideas/` — Execution planning
- `docs/SITEMAP.md` — Navigation for all concepts

## gstack

Use `/browse` from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/retro`, `/debug`, `/document-release`.

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to rebuild.

## Workflow

1. **Start:** `/office-hours` to clarify implementation scope
2. **Product:** `/plan-ceo-review` — validate against cornerstone vision
3. **Architecture:** `/plan-eng-review` — lock technical decisions
4. **Build:** Implement with `/review` gates
5. **Test:** `/qa` before shipping
6. **Ship:** `/ship` for PRs

## Key Principles (from cornerstone)

- Transparency and accountability first
- Decentralized by design
- Privacy-preserving identity
- Community-owned data
- Progressive decentralization strategy

## Directory Structure

```
peoplenet/
├── docs/           → symlink to peoplenet-foundation (research & blueprints)
├── src/            ← Implementation code goes here
├── tests/          ← Test suite
└── .claude/skills/ ← gstack
```
