# Stage 01: Define

## Purpose
Identify the exact manual process being replaced: what is the input, the output, and the data source — answer all three before writing any code.

---

## Inputs

- **Source material or incoming brief** — Paste or reference here.
- **`_config/constraints.md`** — Load for any written output.


---

## Process

1. Review all inputs for this stage.
2. Execute the core work of this stage.
3. Self-check output against the quality criteria below.
4. Write output to the `output/` directory.

---

## Output

Write to: `01_define/output/`

This output becomes the input for **Adjust & Aim**. Write it in a format that the next stage can consume directly.

**Must include:**
- All required outputs for this stage
- A completion note describing what was done

**Must NOT include:**
- Lists of possible causes instead of one fix. Code that buffers all results and writes once at the end. Rewrites of the whole tool when only one broken piece needs correcting. HTS output that doesn't normalize notation format. BigQuery queries that call table-valued functions without UNNEST(). React artifacts using localStorage or sessionStorage. Word documents with color fills, emojis, or decorative elements. Any explanation of what the code does line-by-line when it wasn't asked for. If it is generic and not doing what we inteded

**Done looks like:**
A complete define output in the output/ directory. The next stage (or the recipient) can pick up from here without asking clarifying questions.

---

## Quality Check
Before moving to the next stage, verify:
- [ ] All required output files are in `output/`
- [ ] Output matches the "Done looks like" description above
- [ ] No items from the "Must NOT include" list are present
- [ ] A human has reviewed the output

---
*Layer annotation: L2 — stage contract, loaded per task.*
