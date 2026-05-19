# Workflow: tech-development

## Overview
Workspace for building customs compliance tools, legal practice automation, and personal workflow utilities — from initial problem definition through a working, verified tool. Covers Python scrapers, React artifacts, full-stack SaaS, and document generation.

**Stages:** Define → Adjust & Aim → Build & Volume → Verify → Stage 5

Each stage has a CONTEXT.md (its contract) and an `output/` directory (its handoff point). Human review happens at each handoff before the next stage begins.

---

## Stage Map

| Stage | Purpose | Key Inputs | Output Location | Checkpoint |
|-------|---------|-----------|----------------|------------|
| Define | Identify the exact manual process being replaced: what is the input, the output, and the data source — answer all three before writing any code. | Source material, brief, or incoming work | 01_define/output/ | Human review before proceeding |
| Adjust & Aim | Choose the right form factor and stack for this specific tool — scraper vs. API client vs. artifact vs. full-stack — and sketch the architecture. | Output from 01_define/output/ | 02_adjust-and-aim/output/ | Human review before proceeding |
| Build & Volume | Build the core function on one record first, verify manually, then add batch processing, delays, incremental saves, error logging, and progress indicators. | Output from 02_adjust-and-aim/output/ | 03_build-and-volume/output/ | Human review before proceeding |
| Verify | Run the complete tool against real data, check output format precisely, confirm edge cases (HTS notation, ruling number prefixes, document formatting), and document the result. | Output from 03_build-and-volume/output/ | 04_verify/output/ | Human review before proceeding |
| Stage 5 | Generate a markdown file capturing development details: tool purpose, inputs/outputs, stack decisions, known issues, and final verified behavior. | Output from 04_verify/output/ | 05_document/output/ | Human review before proceeding |

---

## How Stages Connect

- **Define → Adjust & Aim:** Define writes to `01_define/output/`. Adjust & Aim reads from there. Human reviews the output before Adjust & Aim begins.
- **Adjust & Aim → Build & Volume:** Adjust & Aim writes to `02_adjust-and-aim/output/`. Build & Volume reads from there. Human reviews the output before Build & Volume begins.
- **Build & Volume → Verify:** Build & Volume writes to `03_build-and-volume/output/`. Verify reads from there. Human reviews the output before Verify begins.
- **Verify → Stage 5:** Verify writes to `04_verify/output/`. Stage 5 reads from there. Human reviews the output before Stage 5 begins.


**Revision loop:** If a later stage reveals a problem from an earlier stage, return to that stage with specific revision notes. The revision is a scoped work item, not a vague "make changes."

---

## Reference Material

- `_config/voice-and-tone.md` — Voice patterns and teaching style. Load in writing stages.
- `_config/format-patterns.md` — Structural guidance per output format. Load when format matters.
- `_config/constraints.md` — Never-do list. Load in every stage that produces written output.

---

## When to Add Stages
- If a stage consistently has too many steps, split it.
- If two steps are always done together, combine them.
- Start with the minimum. Add stages when the workflow earns the complexity.

---
*Layer annotation: L1 — loaded on workspace entry, workflow routing.*
