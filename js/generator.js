// generator.js — Turns wizard answers into populated markdown file content
// Each generate* function returns a string (file content)

window.ICM = window.ICM || {};

window.ICM.generator = {

  // ─── ROUTING TABLE ────────────────────────────────────────────────────────

  buildRoutingTable(stages, pathPrefix) {
    const header = '| Task | Go to | Read | Notes |\n|------|-------|------|-------|';
    const p = pathPrefix ? String(pathPrefix).replace(/^\/+|\/+$/g, '') + '/' : '';
    const rows = stages.map(s => {
      const dir = p ? `/${p}${s.id}_${s.slug}/` : `/${s.id}_${s.slug}/`;
      return `| ${s.task || 'Work in ' + s.label} | ${dir} | CONTEXT.md | ${s.note || ''} |`;
    });
    return [header, ...rows].join('\n');
  },

  buildAgentRoutingTable(agents) {
    const header = '| Task / signal | Go to | Read first | Notes |\n|------|-------|------------|-------|';
    const list = (agents || []).filter(a => a && typeof a === 'object' && a.slug);
    const rows = list.map(a => {
      const dir = `/agents/${a.slug}/`;
      return `| ${a.task || 'Work in ' + a.label} | ${dir} | agents/${a.slug}/CLAUDE.md | ${a.note || ''} |`;
    });
    return [header, ...rows].join('\n');
  },

  /**
   * Drop null/undefined/sparse entries; normalise slug, label, and string fields.
   * Returns a new array (does not mutate answers.agents unless caller assigns).
   */
  sanitizeAgents(answers) {
    const raw = answers && answers.agents;
    let list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === 'object') {
      const keys = Object.keys(raw)
        .filter(k => /^\d+$/.test(k))
        .sort((a, b) => Number(a) - Number(b));
      if (keys.length) list = keys.map(k => raw[k]);
    }
    return list
      .filter(a => a != null && typeof a === 'object')
      .map((a, i) => {
        const slugRaw = a.slug != null ? String(a.slug) : '';
        const slug =
          slugRaw.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '') ||
          `agent-${i + 1}`;
        const label =
          a.label != null && String(a.label).trim()
            ? String(a.label).trim()
            : `Agent ${i + 1}`;
        return {
          id: String(i + 1).padStart(2, '0'),
          slug,
          label,
          description: a.description != null ? String(a.description) : '',
          task: a.task != null ? String(a.task) : '',
          note: a.note != null ? String(a.note) : ''
        };
      })
      .filter(a => a.slug && a.slug !== 'master' && a.slug !== 'agents')
      .map((a, i) => ({
        ...a,
        id: String(i + 1).padStart(2, '0'),
        slug: a.slug || `agent-${i + 1}`
      }))
      .filter(a => a && typeof a === 'object' && String(a.slug || '').trim() !== '');
  },

  buildNamingConventions(archetype) {
    const conventions = {
      content: [
        '- Drafts: `topic-name_draft.md`',
        '- Final scripts: `topic-name_final.md`',
        '- Published records: `YYYY-MM-platform-topic.md`',
        '- Research notes: `topic-name_research.md`'
      ],
      freelancer: [
        '- Requirements doc: `client-name_requirements.md`',
        '- Deliverable drafts: `deliverable-name_draft.md`',
        '- Final deliverables: `deliverable-name_final.md`',
        '- Meeting notes: `YYYY-MM-DD_meeting-notes.md`'
      ],
      developer: [
        '- Feature specs: `feature-name_spec.md`',
        '- Components: PascalCase (e.g. `UserCard.tsx`)',
        '- Tests: `feature-name.test.ts`',
        '- Decision records: `YYYY-MM-DD-decision-title.md`',
        '- API docs: `endpoint-name_api.md`'
      ],
      smallbiz: [
        '- Incoming work: `YYYY-MM-DD_client-name_brief.md`',
        '- Work in progress: `client-name_wip.md`',
        '- Completed work: `client-name_YYYY-MM_complete.md`',
        '- Templates: `template-name_template.md`'
      ],
      custom: [
        '- Drafts: `topic-name_draft.md`',
        '- Final outputs: `topic-name_final.md`',
        '- References: `topic-name_ref.md`',
        '- Versioned files: `filename_v2.md`, `filename_v3.md`'
      ]
    };
    return (conventions[archetype] || conventions.custom).join('\n');
  },

  // ─── CLAUDE.MD (L0) ───────────────────────────────────────────────────────

  generateCLAUDEmd(answers) {
    const { project_name, description, archetype, stages } = answers;
    const archetypeObj = window.ICM.ARCHETYPES.find(a => a.id === archetype) || {};
    const teamNote = answers.team_size === 'Just me'
      ? 'Single operator workspace.'
      : answers.team_size === '2–3 people'
        ? 'Small team workspace — stage contracts are written for handoff.'
        : 'Team workspace — all stages are documented for consistent multi-person use.';

    const stageList = stages.map(s =>
      `- \`/${s.id}_${s.slug}/\` — ${s.label}: ${s.description || 'See CONTEXT.md'}`
    ).join('\n');

    const routingTable = this.buildRoutingTable(stages);
    const naming = this.buildNamingConventions(archetype);

    return `# ${project_name}

## Identity
${description}

${archetypeObj.label ? `**Workspace type:** ${archetypeObj.label}` : ''}
${teamNote}

---

## Folder Structure
\`\`\`
${project_name}/
  CLAUDE.md              ← You are here (L0 — always loaded)
  CONTEXT.md             ← Workflow routing (L1)
${stages.map(s => `  ${s.id}_${s.slug}/
    CONTEXT.md           ← Stage contract (L2)
    output/              ← Stage output, handoff point`).join('\n')}
  _config/               ← Reference material (L3 — loaded selectively)
    voice-and-tone.md
    format-patterns.md
    constraints.md
  extras/                ← Supporting files not part of stages (see extras/README.md)
  skill-starters/        ← Optional skill prompts (L5)
  README.md              ← How to use this workspace cold
\`\`\`

---

## Routing Table

${routingTable}

---

## Naming Conventions
${naming}

---

## Rules
- Read this file first on every new task.
- Navigate to the relevant workspace stage. Read its CONTEXT.md before starting.
- Load _config/ files selectively — only load what the current stage needs.
- Write **stage deliverables** to the stage's \`output/\` directory. Put long briefs, raw dumps, and "not sure where this goes yet" material in \`extras/\` (see \`extras/README.md\`) — keep stage output clean for handoffs.
- Human review happens at each \`output/\` directory before the next stage begins.
- Ask before creating files outside of their designated stage folder.
- When in doubt, ask. Do not guess at scope.

---

## Current State
- Status: New workspace. No work in progress.
- Last updated: ${new Date().toISOString().split('T')[0]}
- Next step: Read CONTEXT.md for the full workflow, then start at the first stage.

---
*Generated by ICM Workspace Builder — eduba.io / Clief Notes*
*Layer annotation: L0 — always loaded, ~800 tokens, orientation and routing.*
`;
  },

  // ─── CONTEXT.MD (L1) ──────────────────────────────────────────────────────

  generateCONTEXTmd(answers, ctxOpts) {
    const { project_name, description, archetype, stages } = answers;
    const stagePathPrefix = (ctxOpts && ctxOpts.stagePathPrefix) ? String(ctxOpts.stagePathPrefix).replace(/^\/+|\/+$/g, '') + '/' : '';
    const title = (ctxOpts && ctxOpts.titleOverride) ? ctxOpts.titleOverride : `Workflow: ${project_name}`;

    const stageMapRows = stages.map((s, i) => {
      const prev = i > 0 ? stages[i-1] : null;
      const inputs = prev ? `Output from ${stagePathPrefix}${prev.id}_${prev.slug}/output/` : 'Source material, brief, or incoming work';
      const checkpoint = s.checkpoint || 'Human review before proceeding';
      return `| ${s.label} | ${s.purpose || s.description || ''} | ${inputs} | ${stagePathPrefix}${s.id}_${s.slug}/output/ | ${checkpoint} |`;
    });

    const stageConnections = stages.map((s, i) => {
      if (i === stages.length - 1) return null;
      const next = stages[i + 1];
      return `- **${s.label} → ${next.label}:** ${s.label} writes to \`${stagePathPrefix}${s.id}_${s.slug}/output/\`. ${next.label} reads from there. Human reviews the output before ${next.label} begins.`;
    }).filter(Boolean).join('\n');

    const configList = [
      answers.voice_patterns ? '- `_config/voice-and-tone.md` — Voice patterns and teaching style. Load in writing stages.' : null,
      '- `_config/format-patterns.md` — Structural guidance per output format. Load when format matters.',
      '- `_config/constraints.md` — Never-do list. Load in every stage that produces written output.'
    ].filter(Boolean).join('\n');

    return `# ${title}

## Overview
${description}

**Stages:** ${stages.map(s => s.label).join(' → ')}

Each stage has a CONTEXT.md (its contract) and an \`output/\` directory (its handoff point). Human review happens at each handoff before the next stage begins.

---

## Stage Map

| Stage | Purpose | Key Inputs | Output Location | Checkpoint |
|-------|---------|-----------|----------------|------------|
${stageMapRows.join('\n')}

---

## How Stages Connect

${stageConnections}

${stages.length > 1 ? `\n**Revision loop:** If a later stage reveals a problem from an earlier stage, return to that stage with specific revision notes. The revision is a scoped work item, not a vague "make changes."` : ''}

---

## Reference Material

${configList}

---

## When to Add Stages
- If a stage consistently has too many steps, split it.
- If two steps are always done together, combine them.
- Start with the minimum. Add stages when the workflow earns the complexity.

---
*Layer annotation: L1 — loaded on workspace entry, workflow routing.*
`;
  },

  // ─── STAGE CONTEXT.MD (L2) ────────────────────────────────────────────────

  generateStageContextmd(stage, stageIndex, allStages, answers) {
    const prevStage = stageIndex > 0 ? allStages[stageIndex - 1] : null;
    const nextStage = stageIndex < allStages.length - 1 ? allStages[stageIndex + 1] : null;
    const stageNum = String(stageIndex + 1).padStart(2, '0');

    const inputsList = prevStage
      ? `- **\`${prevStage.id}_${prevStage.slug}/output/\`** — Output from the previous stage. Read all files here before starting.\n- **\`_config/constraints.md\`** — Load for any stage that produces written output.\n${stage.extraInputs || ''}`
      : `- **Source material or incoming brief** — Paste or reference here.\n- **\`_config/constraints.md\`** — Load for any written output.\n${stage.extraInputs || ''}`;

    const processList = (stage.process || this.defaultProcess(stage, answers)).map((p, i) =>
      `${i + 1}. ${p}`
    ).join('\n');

    const outputSpec = nextStage
      ? `Write to: \`${stageNum}_${stage.slug}/output/\`\n\nThis output becomes the input for **${nextStage.label}**. Write it in a format that the next stage can consume directly.`
      : `Write to: \`${stageNum}_${stage.slug}/output/\`\n\nThis is the final stage output. Write it in the format that the recipient (client, audience, or user) receives.`;

    const doneLooksLike = stage.doneLooksLike || this.defaultDoneLooksLike(stage, answers);

    const mustNotList = answers.rejection_criteria
      ? answers.rejection_criteria.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`).join('\n')
      : this.defaultMustNot(answers);

    return `# Stage ${stageNum}: ${stage.label}

## Purpose
${stage.purpose || stage.description || `Complete the ${stage.label.toLowerCase()} phase of the workflow.`}

---

## Inputs

${inputsList}

---

## Process

${processList}

---

## Output

${outputSpec}

**Must include:**
${stage.mustInclude || this.defaultMustInclude(stage)}

**Must NOT include:**
${mustNotList}

**Done looks like:**
${doneLooksLike}

---

## Quality Check
Before moving to the next stage, verify:
- [ ] All required output files are in \`output/\`
- [ ] Output matches the "Done looks like" description above
- [ ] No items from the "Must NOT include" list are present
- [ ] A human has reviewed the output

---
*Layer annotation: L2 — stage contract, loaded per task.*
`;
  },

  defaultProcess(stage, answers) {
    const defaults = {
      research: [
        'Read all available source material and reference files.',
        'Identify the core topic, angle, and key points to cover.',
        'Note what you know, what you assume, and what you still need to find out.',
        'Gather supporting evidence, examples, or data.',
        'Write a research summary capturing the angle, key points, and supporting material.'
      ],
      script: [
        'Read the research output from the previous stage.',
        'Load `_config/voice-and-tone.md` and `_config/format-patterns.md`.',
        'Write a first draft following the format pattern for this content type.',
        'Check the draft against `_config/constraints.md`. Fix any violations.',
        'Read the draft aloud (mentally). If it doesn\'t sound like the voice file, revise.'
      ],
      production: [
        'Read the final script or draft from the previous stage.',
        'Prepare production-ready files according to platform requirements.',
        'Apply any format-specific final checks (thumbnail, description, metadata).',
        'Confirm all assets are in place before marking complete.'
      ],
      discovery: [
        'Read the client brief and engagement terms.',
        'Identify the stated problem and hypothesize the actual underlying problem.',
        'List what you know, what you assume, and what you need to find out.',
        'Prepare discovery questions for the client.',
        'Conduct discovery (interviews, document review, or analysis).',
        'Synthesize findings into a requirements document.',
        'Draft scope agreement: what will be delivered, what will NOT, timeline, milestones.',
        'Get client validation on the scope agreement before proceeding.'
      ],
      build: [
        'Read the requirements document and scope agreement from discovery.',
        'Do NOT build from the original client brief — build from the scope agreement.',
        'Work through the deliverable systematically, checking each section against requirements.',
        'Self-check against acceptance criteria before moving to review.',
        'Document any assumptions or decisions made during build.'
      ],
      review: [
        'Internal review first: check deliverable against scope agreement and quality standards.',
        'Fix issues found in internal review before the client sees anything.',
        'Present to client for review.',
        'Capture client feedback as specific, actionable revision items.',
        'If revisions are needed, return to build with the revision notes as a scoped work item.'
      ],
      handoff: [
        'Package all approved deliverables.',
        'Write transition documentation: how to use/operate/maintain the deliverable.',
        'Prepare knowledge transfer materials if applicable.',
        'Deliver and confirm receipt.',
        'Record any ongoing support terms or next steps.'
      ],
      planning: [
        'Read existing architecture decisions and tech stack documentation.',
        'Define the feature or change in specific, testable terms.',
        'Write a spec: what it does, what it doesn\'t do, how it fits the existing architecture.',
        'List open questions and assumptions.',
        'Get spec reviewed before moving to build.'
      ],
      intake: [
        'Review incoming work request.',
        'Check against scope boundaries in `_config/business-rules.md`.',
        'Categorize and prioritize the work item.',
        'Identify any missing information needed before processing can begin.',
        'Request missing information or refer out-of-scope work.',
        'Write a triage summary and place in output/ for the next stage.'
      ],
      process: [
        'Read the triage summary from intake.',
        'Execute the core work according to your standard process.',
        'Self-check against quality standards in `_config/quality-standards.md`.',
        'Document any decisions or deviations from standard process.',
        'Write a completion summary for the deliver stage.'
      ],
      deliver: [
        'Review completed work against quality standards.',
        'Package deliverable in the format the client receives.',
        'Prepare delivery communication.',
        'Deliver and confirm receipt.',
        'Archive the completed work item with outcome notes.'
      ]
    };
    return defaults[stage.slug] || defaults[stage.id] || [
      'Review all inputs for this stage.',
      'Execute the core work of this stage.',
      'Self-check output against the quality criteria below.',
      'Write output to the `output/` directory.'
    ];
  },

  defaultMustInclude(stage) {
    const defaults = {
      research: '- A clear statement of the topic and chosen angle\n- Key supporting points (at least 3)\n- Source references or examples',
      script: '- Opening that establishes the hook or thesis\n- Body following the format pattern\n- Closing that reframes, questions, or implies — not summarizes',
      discovery: '- Requirements document with stated vs actual problem\n- Scope agreement with explicit exclusions\n- Client validation on scope',
      build: '- All deliverables listed in the scope agreement\n- Self-check notes against acceptance criteria',
      review: '- Internal review checklist completed\n- Client feedback captured as specific revision items',
      handoff: '- All deliverables packaged\n- Transition documentation\n- Delivery confirmation'
    };
    return defaults[stage.slug] || defaults[stage.id] || '- All required outputs for this stage\n- A completion note describing what was done';
  },

  defaultMustNot(answers) {
    const base = [
      '- No em dashes — use commas, periods, or parentheses instead',
      '- No bullet-heavy structure where a paragraph would work',
      '- No significance inflation ("pivotal," "groundbreaking," "transformative")',
      '- No AI hedging ("It\'s worth noting," "It could be argued," "Interestingly")',
      '- No summary paragraph at the end unless explicitly requested'
    ];
    if (answers.writing_prohibitions) {
      const custom = answers.writing_prohibitions.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`);
      return [...base, ...custom].join('\n');
    }
    return base.join('\n');
  },

  defaultDoneLooksLike(stage, answers) {
    const defaults = {
      research: 'A research summary file in output/ that contains the angle, key points, and supporting material. The next stage can start from this file without needing to re-read the source material.',
      script: 'A complete script or draft in output/ that matches the format pattern, passes the constraints check, and sounds like the voice file when read aloud.',
      production: 'All production-ready files are in output/. Nothing is missing. The content can be published without further changes.',
      discovery: 'The client has validated the scope agreement. The requirements document captures the actual problem, not just the stated request. Build can start without ambiguity about what "done" means.',
      build: 'All deliverables in the scope agreement are complete and meet their acceptance criteria. The self-check notes confirm this.',
      review: 'Internal review is complete and all issues are resolved. Client has reviewed and provided feedback. Either the deliverable is approved for handoff, or revision notes are specific and actionable.',
      handoff: 'Client has received and confirmed all deliverables. Transition documentation is complete. The client can operate independently.',
      intake: 'A triage summary exists in output/ that categorizes the work, confirms it is in scope, and identifies any missing information. Processing can begin without further questions.',
      deliver: 'Client has received the deliverable. Confirmation is documented. The work item is archived with outcome notes.'
    };
    return defaults[stage.slug] || defaults[stage.id] || `A complete ${stage.label.toLowerCase()} output in the output/ directory. The next stage (or the recipient) can pick up from here without asking clarifying questions.`;
  },

  // ─── VOICE AND TONE (L3) ──────────────────────────────────────────────────

  generateVoiceAndTone(answers) {
    const patterns = answers.voice_patterns
      ? answers.voice_patterns.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`).join('\n')
      : '- [Describe 3–5 patterns in your natural writing or speaking. Not adjectives — actual behaviors.]';

    const audience = answers.audience
      ? answers.audience.trim()
      : '[Describe your specific audience. Role, experience level, what they care about, what they\'re skeptical of.]';

    return `# Voice and Tone

<!--
ANNOTATION: This file describes the conditions under which your voice emerges.
Load this in any stage that involves writing or editing.
Keep this file to 20–40 lines. If it grows beyond that, move format-specific
guidance to format-patterns.md and constraints to constraints.md.

KEY PRINCIPLE: Describe HOW you think and teach, not what personality you want.
"Be engaging" is useless. "Teaches through layers, starting with what people
think they know and peeling it back" produces specific output.

ICM Layer: L3 — reference material, load selectively in writing stages.
-->

## How I Communicate
${patterns}

## Audience
${audience}

## Authority and Credibility
[How does your expertise show up? Do you reference personal experience? Do you
cite research? Do you lead with credentials or let them emerge?]

## What My Voice Is NOT
[Equally important. What does your voice look like when it goes wrong?
"Not corporate." "Not academic." "Not motivational-speaker generic."
Negative boundaries are often more useful than positive descriptions.]

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  },

  // ─── FORMAT PATTERNS (L3) ────────────────────────────────────────────────

  generateFormatPatterns(answers) {
    const formats = answers.formats || [];
    let formatSections = '';

    const formatGuides = {
      'YouTube long-form video': '**YouTube (long-form):** Thread a concept through a narrative arc. Open with a counterintuitive observation or a question the viewer already has. Build the argument across 8–15 minutes. Use examples from real systems, not toy cases. End with an implication, not a summary.',
      'YouTube Shorts / Reels': '**Short-form video (Shorts / Reels):** One insight per video. Open with the hook — no warm-up. Under 90 seconds of script. End with a question or a reframe, not a CTA.',
      'Blog posts / articles': '**Blog post / article:** Lead with the most important point. Support with evidence and examples. Avoid headers unless the content is genuinely reference material. Prose flows better than bulleted structure for most arguments.',
      'Newsletter': '**Newsletter:** One main idea per issue. Short. Conversational. Readers opted in — treat them like colleagues, not an audience. Include something they can use immediately.',
      'Podcast': '**Podcast:** Conversational structure. Premise → exploration → takeaway. Scripts should sound natural when spoken, not read.',
      'LinkedIn posts': '**LinkedIn:** First line is the hook — it determines if they read the rest. No fluff. End with a specific observation or question, not a generic CTA.',
      'Twitter / X threads': '**Twitter / X threads:** First tweet is the standalone point. Subsequent tweets expand. Each tweet should be worth reading alone. No padding.',
      'Instagram content': '**Instagram:** Visual-first. Caption supports the visual. Short. Personal voice.',
      'TikTok': '**TikTok:** Hook in the first second. Pattern interrupt. Keep moving. End decisively.',
      'Course / educational content': '**Course / educational content:** Concept → example → exercise. Each module has one learning objective. Build progressively — each lesson assumes the previous one.'
    };

    if (formats.length > 0) {
      formatSections = formats.map(f => formatGuides[f] || `**${f}:** [Add structural guidance for this format]`).join('\n\n');
    } else {
      formatSections = '[Add one paragraph per content format you produce. Describe what makes it structurally different from the others.]';
    }

    return `# Format Patterns

<!--
ANNOTATION: One short entry per content format you produce regularly.
Each entry describes structural rules for that format — how long, how it opens,
how it closes, how it is structured. Load this file when format matters.
Separate file from voice-and-tone.md because formats change independently of voice.

ICM Layer: L3 — reference material, load selectively.
-->

${formatSections}

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
`;
  },

  // ─── CONSTRAINTS (L3) ────────────────────────────────────────────────────

  generateConstraints(answers) {
    const customRules = answers.writing_prohibitions
      ? answers.writing_prohibitions.split('\n').filter(l => l.trim()).map((l, i) =>
          `${i + 13}. ${l.trim()}`
        ).join('\n')
      : '[Add your own constraints here. When you see a pattern in AI output that you dislike, write it down and add it.]';

    return `# Constraints

<!--
ANNOTATION: The never-do list. Load this in every stage that produces written output.
Keep under 40 lines. Each line is a testable rule the model can check against its output.
Add new constraints as you discover patterns you dislike. Remove ones that no longer apply.

IMPORTANT: This file eliminates the most common AI writing failures.
It is the cheapest file in tokens and the highest in impact.

ICM Layer: L3 — load in all writing and editing stages.
-->

## Hard Rules (never violate)
1. No em dashes. Use commas, periods, or parentheses instead.
2. No bullet-heavy structure where a paragraph would work. Lists are for comparing three or more items, not organizing prose.
3. No significance inflation. Do not use "pivotal," "groundbreaking," "transformative," "revolutionary" unless quoting someone.
4. No AI hedging. Do not use "It's worth noting," "It could be argued," "Interestingly," "Notably."
5. No passive voice in opening sentences. Start active.
6. No summary paragraph at the end unless explicitly requested. End with an implication, a question, or a reframe.
7. No CTA language (subscribe, follow, click) unless explicitly requested.
8. Do not use the word "delve." Ever.
9. Do not use the antithesis pattern ("Not just X, but Y") — it is overused.
10. Do not start with a rhetorical question as the opening line.
11. Avoid "tapestry," "landscape," "ecosystem," "journey" used metaphorically.
12. Sentences average 12–18 words. Mix short and long for rhythm.

## Custom Rules
${customRules}

---
*Last updated: ${new Date().toISOString().split('T')[0]}*
*Source: Vault Toolkit hard rules + custom additions.*
`;
  },

  // ─── CLIENT-DELIVERY _CONFIG FILES ───────────────────────────────────────

  generateClientBrief() {
    return `# Client Brief

<!--
ANNOTATION: The original client communication.
Paste the email, message, meeting notes, or RFP here.
This is the raw input before discovery translates it into requirements.

IMPORTANT: After discovery is complete, this file becomes historical reference.
The working specification is scope-agreement.md. Do NOT build from this file.
Build from the scope agreement.

ICM Layer: L3 — engagement-specific reference.
-->

[Paste client communication here]
`;
  },

  generateEngagementTerms() {
    return `# Engagement Terms

<!--
ANNOTATION: Contract terms, timeline, budget, deliverable list.
Populated at engagement start. Referenced throughout.

ICM Layer: L3 — engagement-specific reference.
-->

## Client
[Client name and contact]

## Engagement
[One sentence description of the engagement]

## Deliverables
[List of what will be delivered, with acceptance criteria]

## Timeline
[Milestones and dates]

## Budget
[Budget or rate structure]

## Review Process
[How and when the client reviews work]

## Change Process
[How scope changes are handled]
`;
  },

  generateScopeAgreement() {
    return `# Scope Agreement

<!--
ANNOTATION: Produced by the discovery stage.
This is the working specification for the engagement.
All subsequent stages work from this, not from the original client brief.

IMPORTANT: Populate this during discovery. Get client validation before build begins.

ICM Layer: L3 — produced in discovery, consumed by all subsequent stages.
-->

## Deliverables
[Explicit list of what will be delivered, with acceptance criteria]

## Exclusions
[What is NOT included. Be specific. This prevents scope creep.]

## Timeline
[Milestones with dates. Include review checkpoints.]

## Review Process
[How and when the client reviews work. What constitutes approval.]

## Change Process
[How scope changes are handled. What triggers a change request.]
`;
  },

  // ─── README.MD ───────────────────────────────────────────────────────────

  generateREADME(answers) {
    const { project_name, description, archetype, stages } = answers;
    const archetypeObj = window.ICM.ARCHETYPES.find(a => a.id === archetype) || {};

    const usageSteps = stages.map((s, i) =>
      `${i + 1}. **${s.label}** — ${s.description || `Work in \`${s.id}_${s.slug}/\``}. Output goes to \`${s.id}_${s.slug}/output/\`.`
    ).join('\n');

    return `# ${project_name}

${description}

**Workspace type:** ${archetypeObj.label || 'Custom'}
**Stages:** ${stages.map(s => s.label).join(' → ')}

---

## How to Use This Workspace

**If you use Claude Code or Cursor:**
Open this folder. On every new task, Claude will read \`CLAUDE.md\` first and understand the workspace. Tell it which stage you want to work in — it will navigate to the right \`CONTEXT.md\` and follow the stage contract.

**If you use Claude Projects:**
Upload the relevant files as knowledge sources. Start with \`CLAUDE.md\` and the stage \`CONTEXT.md\` for the task at hand. Add \`_config/\` files as needed.

**If you use any chat interface:**
Paste the contents of \`CLAUDE.md\` at the start of your session. Navigate to the stage you are working in and paste that stage's \`CONTEXT.md\`. Work from there.

---

## Workflow

${usageSteps}

Human review happens at each \`output/\` directory before the next stage begins.

---

## Reference Material (_config/)

- **\`voice-and-tone.md\`** — How this workspace sounds. Load in writing stages.
- **\`format-patterns.md\`** — Structural guidance per output format. Load when format matters.
- **\`constraints.md\`** — Hard rules for written output. Load in all writing and editing stages.

## Supporting material (\`extras/\`)

- **\`extras/\`** — Long briefs, pasted specs, exports, or anything that is **not** a stage handoff. Read \`extras/README.md\` for conventions. Do not treat \`extras/\` as a substitute for \`output/\` when a stage contract expects a handoff.

---

## Skill Starters (skill-starters/)

This folder contains reusable “skill prompt” templates that map cleanly to your stages.
If you use Cursor Agents / Claude Code, these are a fast way to start the right kind of work without rewriting prompts each time.

---

## Re-opening This Workspace

This folder includes a \`workspace-state.json\` file. To edit and regenerate:
1. Open the [ICM Workspace Builder](https://your-netlify-url.netlify.app)
2. Drag \`workspace-state.json\` onto the home screen
3. Edit your answers and re-download

---

## Architecture (ICM Layer Annotations)

| File | Layer | Loaded When |
|------|-------|------------|
| \`CLAUDE.md\` | L0 | Always — every session |
| \`CONTEXT.md\` | L1 | On workspace entry |
| Stage \`CONTEXT.md\` files | L2 | Per task, when entering a stage |
| \`_config/\` files | L3 | Selectively, per stage contract |
| \`output/\` contents | L4 | When the next stage needs them |
| \`extras/\` | — | Supporting files outside stages (briefs, dumps); see \`extras/README.md\` |

---

*Generated by ICM Workspace Builder*
*Based on Interpretable Context Methodology — eduba.io / Clief Notes*
`;
  },

  // ─── SKILL STARTERS (L5) ──────────────────────────────────────────────────

  generateSkillStarterReadme(answers, pathRoot) {
    const root = pathRoot || answers.project_name;
    const { stages } = answers;
    return `# Skill Starters

These are reusable prompt templates (“skills”) for starting work in each stage.

## How to use
- Pick the stage you’re working in.
- Open the matching skill file.
- Fill in the bracketed sections and run it.

## Stage skills
${stages.map((s, i) => {
  const stageNum = String(i + 1).padStart(2, '0');
  return `- \`${root}/skill-starters/${stageNum}_${s.slug}.md\` → ${s.label}`;
}).join('\n')}

---
*Layer annotation: L5 — skills/prompts (optional).*
`;
  },

  generateStageSkillStarter(stage, stageIndex, answers, pathRoot) {
    const stageNum = String(stageIndex + 1).padStart(2, '0');
    const project = pathRoot || answers.project_name;
    const stageDir = `${project}/${stageNum}_${stage.slug}`;
    const stageContext = `${stageDir}/CONTEXT.md`;
    const prevOut = stageIndex > 0
      ? `${project}/${String(stageIndex).padStart(2, '0')}_${answers.stages[stageIndex - 1].slug}/output/`
      : null;

    return `# Skill: ${stage.label}

## Purpose
Start the **${stage.label}** stage in a consistent way.

## Read first
- \`${project}/CLAUDE.md\`
- \`${stageContext}\`
${prevOut ? `- Review previous output in \`${prevOut}\`` : ''}

## Prompt template

### Context
- Objective: [what you want from ${stage.label}]
- Constraints: [any extra constraints beyond _config/constraints.md]
- Inputs: [links/files/notes to use]

### Task
Do the work for the **${stage.label}** stage following the stage contract exactly.

### Output requirements
- Write all outputs to: \`${stageDir}/output/\`
- Include a short completion note: [what was done + any open questions]
`;
  },

  // ─── MULTI-AGENT HUB (master/ + agents/) ─────────────────────────────────

  /**
   * Week 4 — Cross-folder handoff contract when multiple agent workspaces exist.
   * Written once at hub root; master/ and each agents/<slug>/ reference it.
   */
  generateHandoffMd(answers) {
    const { project_name, description } = answers;
    const agents = this.sanitizeAgents(answers);
    const agentBullets = agents.map(a =>
      `- **\`${project_name}/agents/${a.slug}/\`** — ${a.label}: ${a.task || '[define routing trigger in master CLAUDE.md]'}`
    ).join('\n');

    return `# Handoffs — how this hub passes work between folders (Week 4)

<!--
ICM Week 4 — Multi-root workspaces.
This file is the single contract for work that **crosses** the boundary between
\`master/\` and \`agents/<slug>/\` (or returns). Handoffs inside one folder still
follow each stage's CONTEXT.md and that folder's \`output/\` rules.
-->

## Why this file exists

${description}

This project is a **multi-agent hub**: several full ICM trees share one coordinator (\`master/\`). When work moves from one tree to another, the receiving folder has **no implicit context** from the sending session. A **handoff** is a deliberate, written package so the next folder (or human) can continue without re-discovery.

---

## Two scopes of handoff

### A. Within one folder (unchanged ICM)

Stages hand off only through **numbered \`output/\` directories** inside that same folder (\`master/\` or \`agents/<slug>/\`). Follow that folder's \`CONTEXT.md\` stage map. No extra cross-folder rules.

### B. Across folders (this document)

Use the checklist below whenever work **enters or leaves** \`master/\` vs \`agents/<slug>/\`.

---

## Specialist map (who receives what)

${agentBullets}

Routing signals live in \`${project_name}/master/CLAUDE.md\`. If assignment is wrong, fix the routing table there — do not invent parallel routing in chat.

**Supporting files:** hub-wide raw briefs or long context belong in \`${project_name}/extras/\` (see \`extras/README.md\`) until you split them into handoff notes or stage \`output/\`.

---

## Master → agent (delegation)

**When:** Coordinator has triaged the request and a specialist should own execution.

**Do:**

1. Write a short **handoff note** in the **current master stage's** \`output/\` (e.g. \`master/01_<slug>/output/handoff-to-<agent>-<topic>.md\`) containing:
   - **To:** \`agents/<target-slug>/\` (one primary recipient)
   - **Objective:** one sentence outcome the specialist must produce
   - **Inputs:** paths under \`${project_name}/\` the specialist must read (files already written, not "see Slack")
   - **Constraints:** deadlines, compliance, must-nots
   - **Done looks like:** testable completion for this slice
2. Open the specialist's \`CLAUDE.md\` and continue **only inside** \`agents/<target-slug>/\` until that slice is complete.

**Do not:** paste half-finished state only in chat. The handoff note is the durable record.

---

## Agent → master (return / escalate)

**When:** Specialist hits a blocker outside its domain, needs another agent, or must close the loop with the coordinator.

**Do:**

1. Add **return note** in the **current agent stage's** \`output/\` (e.g. \`agents/<slug>/02_<slug>/output/return-to-master-<topic>.md\`) with:
   - **Summary:** what was completed vs left open
   - **Blocker / reason for return:** specific, not vague ("legal review needed" not "issues")
   - **Proposed next owner:** \`master/\` or another \`agents/<slug>/\` with rationale
   - **Artifacts:** paths under \`${project_name}/\` the coordinator must read
2. Re-read \`master/CLAUDE.md\` and \`master/CONTEXT.md\` before routing onward.

---

## Agent → agent (never skip the coordinator)

Direct agent-to-agent context dumps drift. **Default path:** agent A → **master** (return note) → master updates routing → agent B starts from **its** \`CLAUDE.md\` with a new delegation note.

If you ever shortcut (same human session), you still owe **master/** a one-paragraph log in the appropriate \`master/.../output/\` so the hub stays the system of record.

---

## Handoff checklist (before you leave a folder)

- [ ] **Recipient named** (\`master/\` or specific \`agents/<slug>/\`)
- [ ] **Handoff file** written under the correct \`output/\` with the sections above
- [ ] **Paths** use repo-relative form from \`${project_name}/\` (no broken partial paths)
- [ ] **Human review** at that \`output/\` if your stage contract requires it before the next stage or folder consumes the work
- [ ] **No silent transfers** — if files moved, the note says where and why

---

## Naming suggestion

Use predictable filenames so people (and search) can find them:

- \`handoff-to-<agent-slug>-<short-topic>.md\`
- \`return-to-master-<short-topic>.md\`

---

*Layer note: Hub-level protocol — load when routing or closing work across \`master/\` and \`agents/\`.*
*Generated by ICM Workspace Builder — Week 4 handoff contract*
`;
  },

  generateHubREADME(answers) {
    const { project_name, description } = answers;
    const agents = this.sanitizeAgents(answers);
    const agentLines = agents.map(a =>
      `- **\`agents/${a.slug}/\`** — **${a.label}**${a.description ? ': ' + a.description : ''}`
    ).join('\n');

    return `# ${project_name} — Multi-agent ICM hub

${description}

This bundle contains **one coordinator workspace** (\`master/\`) and **${agents.length} specialist workspaces** (\`agents/<slug>/\`). Each specialist folder is a complete ICM tree (CLAUDE.md, CONTEXT.md, numbered stages, \`_config/\`, \`skill-starters/\`). The master folder runs the same stage shape for **cross-cutting** coordinator work (intake, delegation, synthesis) and holds the **routing table** for which agent to open.

---

## How to use

1. **New ambiguous task** — Read \`master/CLAUDE.md\`, use the specialist routing table to pick \`agents/<slug>/\`, then read that agent's CLAUDE.md.
2. **Clearly scoped to one domain** — Open the matching \`agents/<slug>/CLAUDE.md\` directly.
3. **Work that spans domains** — Run the master workflow stages, then fan out to agents as documented in \`master/CONTEXT.md\`.
4. **Long briefs or raw dumps** — Put them in hub \`extras/\` (see \`extras/README.md\`) until you route them into \`master/\` or an agent; keep stage \`output/\` for real handoffs.

---

## Layout

\`\`\`
${project_name}/
  README.md                 ← You are here
  handoff.md                ← Week 4 — how folders pass work to each other
  extras/                   ← Hub-wide briefs, dumps, non-stage material (see extras/README.md)
  workspace-state.json      ← Drag into ICM Workspace Builder to re-edit
  master/                   ← Coordinator (L0–L5)
  agents/
${agents.map(a => `    ${a.slug}/                ← ${a.label}`).join('\n')}
\`\`\`

## Agents

${agentLines}

---

## Cross-folder handoffs (Week 4)

When work moves **between** \`master/\` and \`agents/<slug>/\` (or back), use the hub contract in **\`handoff.md\`** at this root. It defines what to write, where to put it, and how the coordinator stays the system of record.

---

## Re-open in Workspace Builder

Use \`workspace-state.json\` on the builder home screen to adjust agents, stages, or voice — then re-download.

---
*Generated by ICM Workspace Builder — Multi-agent hub mode*
*Interpretable Context Methodology — eduba.io / Clief Notes*
`;
  },

  generateMasterHubClaude(answers) {
    const { project_name, description, archetype, stages } = answers;
    const agents = this.sanitizeAgents(answers);
    const archetypeObj = window.ICM.ARCHETYPES.find(arch => arch.id === archetype) || {};
    const teamNote = answers.team_size === 'Just me'
      ? 'Single operator hub.'
      : answers.team_size === '2–3 people'
        ? 'Small team — master + agents are documented for handoff.'
        : 'Team hub — coordinator and specialist contexts stay aligned via this file.';

    const agentFolderList = agents.map(a =>
      `- \`agents/${a.slug}/\` — ${a.label}: ${a.description || "See that folder's CLAUDE.md"}`
    ).join('\n');

    const masterRouting = this.buildRoutingTable(stages, 'master');
    const agentDispatch = this.buildAgentRoutingTable(agents);
    const naming = this.buildNamingConventions(archetype);

    return `# Master hub: ${project_name}

## Identity
${description}

**Role:** Coordinator workspace for the **${project_name}** hub. You route work to specialist agents under \`agents/\` and run cross-cutting stages under \`master/\`.

${archetypeObj.label ? `**Workspace type (shared vocabulary):** ${archetypeObj.label}` : ''}
${teamNote}

---

## Folder structure
\`\`\`
${project_name}/
  handoff.md             ← Week 4 — how work passes between master/ and agents/
  master/
    CLAUDE.md              ← You are here (L0 — coordinator map)
    CONTEXT.md             ← Master workflow router (L1)
${stages.map(s => `    ${s.id}_${s.slug}/
      CONTEXT.md           ← Coordinator stage contract (L2)
      output/`).join('\n')}
    _config/
    skill-starters/
    extras/                  ← Coordinator supporting files (see extras/README.md)
  agents/
${agents.map(a => `    ${a.label} (${a.slug})/`).join('\n')}
\`\`\`

---

## Specialist routing (open one agent workspace)

${agentDispatch}

When in doubt: describe the task, match it to the **Task / signal** column, open that agent's \`CLAUDE.md\`, and continue **inside that folder** until the scoped work is done.

---

## Master workflow (coordinator stages)

${masterRouting}

---

## Specialist folders (peek inside)

${agentFolderList}

---

## Naming conventions (shared)
${naming}

---

## Rules
- Read this file first when **assigning** work or **coordinating** multiple agents.
- After routing, **change root** to the specialist \`agents/<slug>/\` folder for domain work — do not mix unrelated domains in one agent session without reason.
- Each agent has its own \`_config/\` copy — tune them per domain if templates diverge.
- Human review still happens at each stage \`output/\` as written in the stage contracts.
- Escalate cross-domain dependencies back through \`master/CONTEXT.md\` and this file.
- **Cross-folder handoffs** (work leaving \`master/\` for an \`agents/\` tree, or returning): follow **\`../handoff.md\`** at the hub root — that file is the Week 4 contract for packages, paths, and coordinator-of-record rules.
- Hub-wide **raw briefs** that are not yet routed to an agent may sit in **\`../extras/\`** at the hub root; promote into \`master/.../output/\` or an agent when you delegate.

---

## Current state
- Status: New hub. No work in progress.
- Last updated: ${new Date().toISOString().split('T')[0]}
- Next step: Read \`master/CONTEXT.md\`, then either run a coordinator stage or open the right \`agents/<slug>/CLAUDE.md\`.

---
*Generated by ICM Workspace Builder — Multi-agent hub — eduba.io / Clief Notes*
*Layer annotation: L0 — coordinator map.*
`;
  },

  generateAgentHubClaude(answers, agent) {
    if (!agent || typeof agent !== 'object' || !agent.slug) {
      return '# Specialist agent\n\nAgent metadata was missing during generation. Re-open this project in ICM Workspace Builder and regenerate.\n';
    }
    const { project_name, description, archetype, stages } = answers;
    const archetypeObj = window.ICM.ARCHETYPES.find(arch => arch.id === archetype) || {};
    const routingTable = this.buildRoutingTable(stages);
    const naming = this.buildNamingConventions(archetype);
    const identity = [
      agent.description && agent.description.trim(),
      `Part of hub **${project_name}**. Coordinator + routing: \`../master/CLAUDE.md\`.`
    ].filter(Boolean).join('\n\n');

    const stageList = stages.map(s =>
      `- \`${s.id}_${s.slug}/\` — ${s.label}: ${s.description || 'See CONTEXT.md'}`
    ).join('\n');

    return `# ${agent.label}

## Identity
${identity || description}

**Agent slug:** \`${agent.slug}\` — under \`${project_name}/agents/${agent.slug}/\`
${archetypeObj.label ? `**Shared workspace type:** ${archetypeObj.label}` : ''}

---

## Folder structure
\`\`\`
agents/${agent.slug}/
  CLAUDE.md              ← You are here (L0)
  CONTEXT.md             ← This agent’s workflow router (L1)
${stages.map(s => `  ${s.id}_${s.slug}/
    CONTEXT.md           ← Stage contract (L2)
    output/`).join('\n')}
  _config/
  skill-starters/
  extras/                ← Agent-specific supporting files (see extras/README.md)
\`\`\`

---

## Routing (stages inside this agent)

${routingTable}

---

## Naming conventions
${naming}

---

## Rules
- Read this file first **when all work for this session belongs to ${agent.label}** (${agent.task || 'see master routing table for signals'}).
- Load \`_config/\` selectively per the stage contract.
- Write outputs only to the active stage’s \`output/\` directory.
- Long or messy supporting text can live in \`extras/\` (see \`extras/README.md\`) until it is distilled into stage output or \`_config/\`.
- If the task spans another domain, stop and return to \`../master/CLAUDE.md\` for reassignment.
- When another folder must pick up your work, produce a **handoff package** as defined in **\`../../handoff.md\`** (hub root) — do not assume the next reader has your chat history.

---

## Current state
- Status: New agent workspace.
- Last updated: ${new Date().toISOString().split('T')[0]}
- Next step: Read \`CONTEXT.md\`, then enter the correct numbered stage.

---
*Generated by ICM Workspace Builder — Agent: ${agent.label}*
*Layer annotation: L0 — specialist map.*
`;
  },

  generateAgentContext(answers, agent) {
    if (!agent || typeof agent !== 'object' || !agent.slug) {
      return '# CONTEXT\n\nAgent metadata was missing during generation. Regenerate from ICM Workspace Builder.\n';
    }
    const base = this.generateCONTEXTmd(answers, {
      titleOverride: `Workflow: ${agent.label} (${answers.project_name})`
    });
    return `${base}

---

## Hub coordination

- **Coordinator:** \`${answers.project_name}/master/CLAUDE.md\` and \`master/CONTEXT.md\`
- **Cross-folder handoffs (Week 4):** \`${answers.project_name}/handoff.md\`
- **Hub-wide supporting files:** \`${answers.project_name}/extras/\` (see \`extras/README.md\`)
- **Routing hint for this agent:** ${agent.task || 'Use the master specialist routing table.'}
- If work spills outside **${agent.label}**, close this context and re-open from the master hub.

---
*Layer annotation: L1 — specialist router (nested under agents/).*
`;
  },

  /**
   * Optional `extras/` tree for material outside stages (briefs, dumps, WIP).
   * @param {'single'|'hub'|'master'|'agent'} scope
   * @param {{ label: string, slug: string } | null} agent — required when scope === 'agent'
   */
  generateExtrasReadme(answers, scope, agent) {
    const pn = answers.project_name;
    // Do NOT use one object literal with all scopes: JS evaluates every property
    // value first, so the `agent` template would run even for scope === 'hub'
    // and throw (third argument omitted → agent is undefined).
    let intro;
    switch (scope) {
      case 'hub':
        intro = `This folder is at the **hub root** (${pn}/) beside \`master/\`, \`agents/\`, and \`handoff.md\`. Put material that applies to the **whole project** (full client brief, long research dumps, exported chats) rather than duplicating it inside every agent.`;
        break;
      case 'master':
        intro = `This folder is under **${pn}/master/** — coordinator-only. Use it for delegation notes, synthesis drafts, or meeting logs that are not yet (or never) a numbered stage artifact.`;
        break;
      case 'agent': {
        const ag =
          agent && typeof agent === 'object' && agent.slug && agent.label != null
            ? agent
            : { slug: 'specialist', label: 'Specialist' };
        intro = `This folder is under **${pn}/agents/${ag.slug}/** — material specific to **${ag.label}** only (checklists, clipped requirements, WIP notes). Keep domain noise out of \`output/\` unless a stage contract says to put it there.`;
        break;
      }
      case 'single':
      default:
        intro = `This folder sits next to your numbered stages, \`_config/\`, and \`skill-starters/\` in **${pn}/**. It is **not** an ICM stage — it is a parking lot for supporting files so stage \`output/\` stays clean for real handoffs.`;
        break;
    }

    return `# extras/ — supporting files

${intro}

---

## What belongs here

- Long or messy **source material** you need nearby but do not want in \`_config/\` (stable reference) yet.
- **Pasted briefs**, email threads, or meeting notes you will distill into stage work later.
- **Scratch drafts** that are not ready to live in a stage \`output/\`.
- One-off exports (CSV, JSON snapshots) used across sessions.

## What does *not* belong here

- **Final handoffs between stages** — those belong in the correct stage \`output/\` per CONTEXT.md.
- **Stable voice / format / rules** — refine and move into \`_config/\` when they stop changing every week.

---

## Suggested layout (you create subfolders as needed)

\`\`\`
extras/
  README.md          ← You are here
  briefs/            ← optional — full RFPs, SOWs
  imports/           ← optional — pasted or downloaded source text
  archive/           ← optional — old versions you might reference
\`\`\`

You may add any subfolders or \`.md\` files. Prefer short, descriptive filenames. If something graduates to "always load this," consider moving it into \`_config/\` and referencing it from the relevant stage contract.

---

## Moving work into the formal workflow

1. **Distill** — extract decisions, scope, and tasks from \`extras/\` into stage-appropriate files under \`NN_slug/output/\` or into \`_config/\`.
2. **Link** — from a stage CONTEXT or a handoff note, point to \`extras/...\` paths so the next reader knows what to read.
3. **Prune** — delete or archive in \`extras/archive/\` when material is fully superseded (keeps token load sane if you use AI on the tree).

---
*Generated by ICM Workspace Builder — extras/ convention*
`;
  },

  appendSharedConfigAndSkills(files, answers, rootPrefix, extrasFor = null) {
    const { stages } = answers;
    files[`${rootPrefix}/_config/voice-and-tone.md`] = this.generateVoiceAndTone(answers);
    files[`${rootPrefix}/_config/format-patterns.md`] = this.generateFormatPatterns(answers);
    files[`${rootPrefix}/_config/constraints.md`] = this.generateConstraints(answers);

    files[`${rootPrefix}/skill-starters/README.md`] = this.generateSkillStarterReadme(answers, rootPrefix);
    stages.forEach((stage, i) => {
      const stageNum = String(i + 1).padStart(2, '0');
      files[`${rootPrefix}/skill-starters/${stageNum}_${stage.slug}.md`] =
        this.generateStageSkillStarter(stage, i, answers, rootPrefix);
    });

    if (answers.archetype === 'freelancer') {
      files[`${rootPrefix}/_config/client-brief.md`] = this.generateClientBrief();
      files[`${rootPrefix}/_config/engagement-terms.md`] = this.generateEngagementTerms();
      files[`${rootPrefix}/_config/scope-agreement.md`] = this.generateScopeAgreement();
      files[`${rootPrefix}/_references/README.md`] = `# References\n\nPlace domain frameworks, methodologies, and prior work from similar engagements here.\nThis folder can be shared across clients. Keep client-specific information in \`_config/\` instead.\n`;
    }

    if (extrasFor === 'master') {
      files[`${rootPrefix}/extras/README.md`] = this.generateExtrasReadme(answers, 'master');
      files[`${rootPrefix}/extras/.gitkeep`] = '';
    } else if (extrasFor && typeof extrasFor === 'object' && extrasFor.slug && extrasFor.label) {
      files[`${rootPrefix}/extras/README.md`] = this.generateExtrasReadme(answers, 'agent', extrasFor);
      files[`${rootPrefix}/extras/.gitkeep`] = '';
    }
  },

  generateMultiWorkspaceFiles(answers) {
    const files = {};
    const pn = answers.project_name;
    const stages = answers.stages;
    const agents = this.sanitizeAgents(answers).filter(
      a => a && typeof a === 'object' && String(a.slug || '').trim() !== ''
    );
    answers.agents = agents;
    if (agents.length < 2) {
      return this.generateSingleWorkspaceFiles(answers);
    }

    files[`${pn}/README.md`] = this.generateHubREADME(answers);
    files[`${pn}/handoff.md`] = this.generateHandoffMd(answers);
    files[`${pn}/workspace-state.json`] = JSON.stringify(answers, null, 2);
    files[`${pn}/extras/README.md`] = this.generateExtrasReadme(answers, 'hub');
    files[`${pn}/extras/.gitkeep`] = '';

    const mp = `${pn}/master`;
    files[`${mp}/CLAUDE.md`] = this.generateMasterHubClaude(answers);

    const masterCtx = this.generateCONTEXTmd(answers, {
      stagePathPrefix: 'master/',
      titleOverride: `Workflow: ${answers.project_name} (Master hub)`
    });
    const agentTableRows = agents.map(a => {
      const desc = (a.description || '—').replace(/\|/g, '/').replace(/\n/g, ' ');
      const task = (a.task || '—').replace(/\|/g, '/').replace(/\n/g, ' ');
      return `| **${a.label}** | ${desc} | ${task} |`;
    }).join('\n');
    files[`${mp}/CONTEXT.md`] = `${masterCtx}

---

## Specialist agents (under \`agents/\`)

| Agent | Role | Open when |
|-------|------|-----------|
${agentTableRows}

Each \`agents/<slug>/\` tree mirrors this hub’s **stage numbering** but is scoped to that agent’s domain. Route ambiguous work through this section and \`master/CLAUDE.md\`.

**Week 4 — Cross-folder handoffs:** follow \`../handoff.md\` at the hub root whenever work moves between \`master/\` and \`agents/<slug>/\` (or back). That file is the canonical package format and coordinator-of-record rules.
`;

    stages.forEach((stage, i) => {
      if (!stage || typeof stage !== 'object') return;
      const stageNum = String(i + 1).padStart(2, '0');
      const sp = `${mp}/${stageNum}_${stage.slug}`;
      files[`${sp}/CONTEXT.md`] = this.generateStageContextmd(stage, i, stages, answers);
      files[`${sp}/output/.gitkeep`] = '';
    });

    this.appendSharedConfigAndSkills(files, answers, mp, 'master');

    agents.forEach(agent => {
      if (!agent || typeof agent !== 'object' || !agent.slug) return;
      const ap = `${pn}/agents/${agent.slug}`;
      files[`${ap}/CLAUDE.md`] = this.generateAgentHubClaude(answers, agent);
      files[`${ap}/CONTEXT.md`] = this.generateAgentContext(answers, agent);
      stages.forEach((stage, i) => {
        if (!stage || typeof stage !== 'object') return;
        const stageNum = String(i + 1).padStart(2, '0');
        const sp = `${ap}/${stageNum}_${stage.slug}`;
        files[`${sp}/CONTEXT.md`] = this.generateStageContextmd(stage, i, stages, answers);
        files[`${sp}/output/.gitkeep`] = '';
      });
      this.appendSharedConfigAndSkills(files, answers, ap, { label: agent.label, slug: agent.slug });
    });

    return files;
  },

  generateSingleWorkspaceFiles(answers) {
    const files = {};
    const { project_name, stages } = answers;

    // Root files
    files[`${project_name}/CLAUDE.md`] = this.generateCLAUDEmd(answers);
    files[`${project_name}/CONTEXT.md`] = this.generateCONTEXTmd(answers);
    files[`${project_name}/README.md`] = this.generateREADME(answers);

    // Stage files
    stages.forEach((stage, i) => {
      const stageNum = String(i + 1).padStart(2, '0');
      const stagePath = `${project_name}/${stageNum}_${stage.slug}`;
      files[`${stagePath}/CONTEXT.md`] = this.generateStageContextmd(stage, i, stages, answers);
      files[`${stagePath}/output/.gitkeep`] = '';
    });

    // Config files
    files[`${project_name}/_config/voice-and-tone.md`] = this.generateVoiceAndTone(answers);
    files[`${project_name}/_config/format-patterns.md`] = this.generateFormatPatterns(answers);
    files[`${project_name}/_config/constraints.md`] = this.generateConstraints(answers);

    // Skill starters (optional layer)
    files[`${project_name}/skill-starters/README.md`] = this.generateSkillStarterReadme(answers);
    stages.forEach((stage, i) => {
      const stageNum = String(i + 1).padStart(2, '0');
      files[`${project_name}/skill-starters/${stageNum}_${stage.slug}.md`] = this.generateStageSkillStarter(stage, i, answers);
    });

    files[`${project_name}/extras/README.md`] = this.generateExtrasReadme(answers, 'single');
    files[`${project_name}/extras/.gitkeep`] = '';

    // Extra config for client delivery
    if (answers.archetype === 'freelancer') {
      files[`${project_name}/_config/client-brief.md`] = this.generateClientBrief();
      files[`${project_name}/_config/engagement-terms.md`] = this.generateEngagementTerms();
      files[`${project_name}/_config/scope-agreement.md`] = this.generateScopeAgreement();
      files[`${project_name}/_references/README.md`] = `# References\n\nPlace domain frameworks, methodologies, and prior work from similar engagements here.\nThis folder can be shared across clients. Keep client-specific information in \`_config/\` instead.\n`;
    }

    // State file for re-opening
    files[`${project_name}/workspace-state.json`] = JSON.stringify(answers, null, 2);

    return files;
  },

  // ─── MASTER GENERATE FUNCTION ────────────────────────────────────────────

  generateAllFiles(answers) {
    const layout = answers.workspace_layout || 'single';
    if (layout === 'multi') {
      const clean = this.sanitizeAgents(answers);
      if (clean.length >= 2) {
        answers.agents = clean;
        return this.generateMultiWorkspaceFiles(answers);
      }
    }
    return this.generateSingleWorkspaceFiles(answers);
  }
};
