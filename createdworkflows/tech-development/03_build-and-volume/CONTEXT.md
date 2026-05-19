# Stage 03: Build & Volume

## Purpose
Build the core function on one record first, verify manually, then add batch processing, delays, incremental saves, error logging, and progress indicators.

---

## Inputs

- **`02_adjust-and-aim/output/`** — Output from the previous stage. Read all files here before starting.
- **`_config/constraints.md`** — Load for any stage that produces written output.


---

## Process

1. Review all inputs for this stage.
2. Execute the core work of this stage.
3. Self-check output against the quality criteria below.
4. Write output to the `output/` directory.

---

## Output

Write to: `03_build-and-volume/output/`

This output becomes the input for **Verify**. Write it in a format that the next stage can consume directly.

**Must include:**
- All required outputs for this stage
- A completion note describing what was done

**Must NOT include:**
- Lists of possible causes instead of one fix. Code that buffers all results and writes once at the end. Rewrites of the whole tool when only one broken piece needs correcting. HTS output that doesn't normalize notation format. BigQuery queries that call table-valued functions without UNNEST(). React artifacts using localStorage or sessionStorage. Word documents with color fills, emojis, or decorative elements. Any explanation of what the code does line-by-line when it wasn't asked for. If it is generic and not doing what we inteded

**Done looks like:**
A complete build & volume output in the output/ directory. The next stage (or the recipient) can pick up from here without asking clarifying questions.

---

## Quality Check
Before moving to the next stage, verify:
- [ ] All required output files are in `output/`
- [ ] Output matches the "Done looks like" description above
- [ ] No items from the "Must NOT include" list are present
- [ ] A human has reviewed the output

---
*Layer annotation: L2 — stage contract, loaded per task.*
