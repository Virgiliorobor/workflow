// questions.js — All question content, teaching text, and archetype definitions
// Each question has: id, type, label, placeholder/options, teaching { title, body }

const ARCHETYPES = [
  {
    id: 'content',
    label: 'Content Creator',
    icon: '🎬',
    description: 'Videos, articles, newsletters, social media — you produce content regularly',
    stageDefaults: ['research', 'script', 'production'],
    stageLabels: ['Research', 'Script / Draft', 'Production']
  },
  {
    id: 'freelancer',
    label: 'Freelancer / Consultant',
    icon: '💼',
    description: 'You deliver projects or services to clients across multiple engagements',
    stageDefaults: ['discovery', 'build', 'review', 'handoff'],
    stageLabels: ['Discovery', 'Build', 'Review', 'Handoff']
  },
  {
    id: 'developer',
    label: 'Developer',
    icon: '⚙️',
    description: 'You build software — planning, writing code, testing, deploying, documenting',
    stageDefaults: ['planning', 'build', 'docs'],
    stageLabels: ['Planning', 'Build', 'Docs']
  },
  {
    id: 'smallbiz',
    label: 'Small Business Ops',
    icon: '🏢',
    description: 'Recurring operational work — the same type of job comes in regularly',
    stageDefaults: ['intake', 'process', 'deliver'],
    stageLabels: ['Intake', 'Process', 'Deliver']
  },
  {
    id: 'custom',
    label: 'Custom / Other',
    icon: '✏️',
    description: 'Your workflow doesn\'t fit the above — you\'ll define it yourself',
    stageDefaults: ['stage-1', 'stage-2', 'stage-3'],
    stageLabels: ['Stage 1', 'Stage 2', 'Stage 3']
  }
];

// Universal questions — asked for every archetype
const UNIVERSAL_QUESTIONS = [
  {
    id: 'project_name',
    type: 'text',
    label: 'What is the name of this project or workspace?',
    placeholder: 'e.g. my-content-studio, alpha-client-work, personal-blog',
    hint: 'Use lowercase with hyphens — this becomes your root folder name.',
    teaching: {
      title: 'Why naming matters',
      body: 'The folder name is the first thing Claude sees when it enters your workspace. A clear, descriptive name means the AI (and you, in six months) immediately knows what this workspace is for. Naming conventions eliminate the need for databases or complex search — the name carries the context.'
    }
  },
  {
    id: 'description',
    type: 'textarea',
    label: 'In 1–2 sentences, describe what you do in this workspace.',
    placeholder: 'e.g. I create weekly YouTube tutorials about personal finance for people in their 30s. I cover budgeting, investing, and career moves.',
    teaching: {
      title: 'The identity statement',
      body: 'This goes into your CLAUDE.md — the file Claude reads first on every task. Think of it as the floor plan of a building. Before a visitor knows where anything is, they read the floor plan. Your description is the first line of that floor plan. It orients the AI immediately, without it having to read every file.'
    }
  }
];

// Archetype-specific question sets
const ARCHETYPE_QUESTIONS = {
  content: [
    {
      id: 'formats',
      type: 'checkboxes',
      label: 'What content formats do you produce regularly? (Select all that apply)',
      options: [
        'YouTube long-form video', 'YouTube Shorts / Reels', 'Blog posts / articles',
        'Newsletter', 'Podcast', 'LinkedIn posts', 'Twitter / X threads',
        'Instagram content', 'TikTok', 'Course / educational content', 'Other'
      ],
      teaching: {
        title: 'Format patterns — why they need their own file',
        body: 'A YouTube tutorial and an Instagram reel are structurally different tasks. If Claude doesn\'t know which format you\'re producing, it defaults to one generic structure for everything. A format-patterns file tells it: "for short-form, open with the hook, no warm-up, under 90 seconds." One sentence per format. The model hits your structure from the first draft.'
      }
    },
    {
      id: 'process',
      type: 'textarea',
      label: 'Walk through your process from idea to published. What are the 2–4 distinct steps?',
      placeholder: 'e.g. 1. Research the topic and find the angle\n2. Write the script or outline\n3. Record/produce\n4. Edit and publish',
      teaching: {
        title: 'Stages = mental modes, not calendar steps',
        body: 'The key question is: when do you shift mental gears? Research and writing are different modes of thinking. Writing and editing are different. Each mode becomes a workspace stage. What you don\'t want is a single giant folder where brainstorming, drafting, and final copy all live together — Claude can\'t separate them and neither can you.'
      }
    },
    {
      id: 'audience',
      type: 'textarea',
      label: 'Who is your audience? Be specific.',
      placeholder: 'e.g. Working developers with 2–8 years of experience who are technical decision makers. They are skeptical of hype and respond to concrete examples.',
      teaching: {
        title: 'Audience description beats persona instructions',
        body: 'Telling Claude "be engaging and authoritative" is useless. Telling it "the audience is mid-market HR directors who have tried three other tools and are skeptical of AI claims" gives it something to work with. The second one changes the output more than the first. Describe your actual audience, not an aspiration.'
      }
    },
    {
      id: 'reference_material',
      type: 'textarea',
      label: 'What reference material stays the same across all your content? (brand guide, style rules, topic list, etc.)',
      placeholder: 'e.g. My brand voice guide, a list of topics I cover, platform-specific rules for each channel, a "words I never use" list',
      teaching: {
        title: 'Layer 3 — the stable reference layer',
        body: 'Some context changes every project (the script you\'re writing). Some context never changes (your brand voice). Separating these is critical. Your stable reference goes into _config/ — it loads selectively, only when a stage actually needs it. This keeps your context window clean and prevents the model from reading your brand guide when it should be producing a first draft.'
      }
    },
    {
      id: 'rejection_criteria',
      type: 'textarea',
      label: 'What would make you immediately reject a draft? What patterns do you hate?',
      placeholder: 'e.g. Bullet-heavy structure when paragraphs would work better. Overly formal tone. Em dashes everywhere. "It\'s worth noting that..." type sentences.',
      teaching: {
        title: 'Constraints file — your never-do list',
        body: 'Most people can describe what they DON\'T want more easily than what they do want. Use that. Your rejection criteria become your constraints file — the cheapest file in tokens and the highest in impact. It eliminates the most common failure modes before they happen. This file loads in every writing stage. Add to it every time you see a pattern you dislike.'
      }
    }
  ],

  freelancer: [
    {
      id: 'deliverable',
      type: 'textarea',
      label: 'What do you typically deliver to clients? Be specific.',
      placeholder: 'e.g. A strategy document and implementation roadmap. Usually 20–40 pages, PDF format, with an executive summary and detailed appendices.',
      teaching: {
        title: '"Done looks like" — the anchor against drift',
        body: 'Output drift happens when instructions leave gaps and the model fills them with its best guess. Describing your deliverable precisely — format, length, structure, what success looks like — is the single highest-impact thing you can add to a stage contract. It gives the model a target to check its own output against.'
      }
    },
    {
      id: 'discovery',
      type: 'textarea',
      label: 'How do engagements start? Do you do a formal discovery phase, or do you scope as you go?',
      placeholder: 'e.g. I always do a 1-hour discovery call, then send a written scope proposal. Sometimes the scope changes after the call.',
      teaching: {
        title: 'Discovery is the highest-value stage',
        body: 'The most common cause of failed engagements is insufficient discovery. The original brief is what the client said. The requirements document is what they need. These are often different. A separate discovery stage — with its own contract and explicit outputs — forces the work before building starts. Skipping it is the root cause of most scope creep.'
      }
    },
    {
      id: 'review_process',
      type: 'textarea',
      label: 'How does client review work? Do they see drafts or only the final? How do you handle revision requests?',
      placeholder: 'e.g. I do one internal review pass before showing the client anything. Client gets one round of revisions included. Additional rounds are billed separately.',
      teaching: {
        title: 'Review as a separate stage — not combined with build',
        body: 'Combining build and review creates pressure to skip review when the deadline is tight. Making review its own stage with its own contract means it is a non-negotiable part of the workflow — not something you do if there\'s time. Internal review happens before the client sees anything. This catches issues when they\'re cheap to fix.'
      }
    },
    {
      id: 'failure_modes',
      type: 'textarea',
      label: 'What causes your engagements to go wrong? What problems do you see repeatedly?',
      placeholder: 'e.g. Scope creep. Client doesn\'t respond to review requests. Requirements were unclear at the start. Work expands beyond what was agreed.',
      teaching: {
        title: 'Failure modes drive workspace design',
        body: 'Every workspace design decision should point back to a specific failure mode you\'ve experienced. Scope creep gets caught in discovery with an explicit scope agreement. Unclear requirements get a separate discovery stage that produces a requirements document. Client unresponsiveness gets a review stage with explicit checkpoints. Your failure modes are your requirements.'
      }
    },
    {
      id: 'reference_material',
      type: 'textarea',
      label: 'What do you reuse across clients? (templates, frameworks, methodologies, prior work)',
      placeholder: 'e.g. Proposal template, standard report structure, analysis frameworks from past projects. I have about 5 templates I pull from regularly.',
      teaching: {
        title: '_references/ vs _config/ — a critical separation',
        body: 'Config holds engagement-specific context (this client, this project, these terms). References hold domain knowledge that applies across engagements (frameworks, methodologies, prior work from similar projects). Separating them means you can share references across clients without sharing client-specific information. This is the same principle that makes software modular.'
      }
    },
    {
      id: 'post_delivery',
      type: 'text',
      label: 'What happens after you deliver? Ongoing support? Knowledge transfer? Or engagement ends?',
      placeholder: 'e.g. Engagement ends at delivery, but I usually include a 30-minute walkthrough call.',
      teaching: {
        title: 'Handoff is not just sending files',
        body: 'Delivery without transition planning creates ongoing dependency — the client calls you every time something needs to change. The handoff stage produces documentation and knowledge transfer materials so the client can operate independently. If you skip this, it compounds. Build the documentation into the workflow, not as an afterthought.'
      }
    }
  ],

  developer: [
    {
      id: 'app_description',
      type: 'textarea',
      label: 'What are you building? What does it do?',
      placeholder: 'e.g. A web app that lets small teams track client feedback across projects. React frontend, Node backend, Postgres database.',
      teaching: {
        title: 'Tech stack in the routing file',
        body: 'Your CLAUDE.md lists the tech stack upfront. This means any session that reads it immediately knows you\'re in a React/Node/Postgres environment — not a Python/Django environment. The model adapts its suggestions to your stack without you having to re-explain it every session.'
      }
    },
    {
      id: 'tech_stack',
      type: 'textarea',
      label: 'What is your tech stack? (frontend, backend, database, deploy)',
      placeholder: 'e.g. Frontend: React + TypeScript. Backend: Node/Express. Database: Postgres. Deploy: Vercel + Railway.',
      teaching: {
        title: 'Context that never changes belongs in Layer 0',
        body: 'Your tech stack is stable. It doesn\'t change between tasks. Putting it in CLAUDE.md means it loads in every session automatically. You never re-explain it. The model never guesses. This is the difference between a context that needs to be re-established and a workspace that carries its own state.'
      }
    },
    {
      id: 'work_modes',
      type: 'checkboxes',
      label: 'What are your main modes of work? (Select all that apply)',
      options: [
        'Planning / spec writing', 'Writing code', 'Testing', 'Documentation',
        'Code review', 'Deployment / DevOps', 'Bug investigation', 'Architecture design'
      ],
      teaching: {
        title: 'Each mode = a workspace or stage',
        body: 'Planning and coding are different mental modes. Documentation and deployment are different again. Each mode benefits from different context: the planning stage needs architecture decisions; the coding stage needs naming conventions and patterns; the docs stage needs documentation standards. Separating them means each stage only loads the context it actually needs.'
      }
    },
    {
      id: 'code_standards',
      type: 'textarea',
      label: 'What coding standards, naming conventions, or patterns does your project follow?',
      placeholder: 'e.g. PascalCase for components, camelCase for functions. Tests required for all new features. No direct DOM manipulation. Functional components only.',
      teaching: {
        title: 'Standards in the src CONTEXT.md — not in every prompt',
        body: 'Your coding standards belong in the CONTEXT.md for your source workspace. They load when Claude is working in code and don\'t load when it\'s writing documentation or planning. This is Layer 3 — reference material that stays stable, loaded selectively. The model writes code that fits your codebase because it read the rules first.'
      }
    },
    {
      id: 'rejection_criteria',
      type: 'textarea',
      label: 'What would make you reject a piece of AI-generated code or documentation immediately?',
      placeholder: 'e.g. Code that doesn\'t follow our naming conventions. Documentation that doesn\'t include usage examples. Tests that just test implementation details.',
      teaching: {
        title: 'The never-do list for code',
        body: 'The same principle that applies to writing applies to code. Explicit exclusions prevent the most common drift paths. "Must NOT use var" is a hard rule the model can check against its own output. "Must NOT skip error handling" catches a common omission before it reaches review. Your rejection criteria are your quality gates — wire them into the stage contracts.'
      }
    }
  ],

  smallbiz: [
    {
      id: 'core_work',
      type: 'textarea',
      label: 'What does your business do repeatedly? Describe the work that comes in regularly.',
      placeholder: 'e.g. We do monthly bookkeeping for small businesses. About 15 clients, each takes 3–5 hours per month.',
      teaching: {
        title: 'Recurring work is the automation target',
        body: 'The architecture is designed for work that follows the same pattern each time. One-off projects are different. The recurring work is where you build the workspace — because the same stages, the same reference material, and the same quality standards apply every time. Once it\'s built, it gets better with each run.'
      }
    },
    {
      id: 'intake',
      type: 'textarea',
      label: 'How does new work come in? What information arrives with it?',
      placeholder: 'e.g. Email from clients with attachments. Sometimes the brief is complete, usually I need to ask 2–3 follow-up questions.',
      teaching: {
        title: 'Intake means triage, not just receiving',
        body: 'The first stage doesn\'t just receive work — it evaluates, categorizes, and prioritizes. If you skip triage, everything feels equally urgent and nothing gets done well. The intake stage has your scope boundaries built in. It\'s where scope creep gets caught before work starts, not after you\'ve spent hours on something outside the original agreement.'
      }
    },
    {
      id: 'process_steps',
      type: 'textarea',
      label: 'Walk through the steps from "work arrives" to "client has the deliverable."',
      placeholder: 'e.g. 1. Review what came in and categorize it. 2. Do the work. 3. Internal quality check. 4. Send to client with a summary.',
      teaching: {
        title: 'Each step = a stage with its own contract',
        body: 'A stage contract is a simple specification: what goes in (inputs), what happens (process steps), what comes out (output), and what "done" looks like. When every stage has a contract, a new team member can pick up any stage and do the work correctly. The workspace is the training, not a verbal walkthrough.'
      }
    },
    {
      id: 'scope_boundaries',
      type: 'textarea',
      label: 'What do you do and what do you NOT do? Where do you draw the line?',
      placeholder: 'e.g. We do bookkeeping and tax prep. We don\'t do financial planning or legal advice. We refer payroll to a specialist.',
      teaching: {
        title: 'Scope boundaries in business-rules.md',
        body: 'Your service boundaries go into _config/business-rules.md. They\'re loaded during intake, so scope is evaluated before work begins — not after three hours of out-of-scope work. Explicit exclusions ("we do not do X") are more useful than positive descriptions because they eliminate the most common scope creep patterns.'
      }
    },
    {
      id: 'quality_bar',
      type: 'textarea',
      label: 'What does a good deliverable look like? What would embarrass you to send?',
      placeholder: 'e.g. Reports should be clean, consistent formatting, no calculation errors, plain English summary at the top. I\'d be embarrassed to send anything with a typo or wrong numbers.',
      teaching: {
        title: 'Quality standards = the deliver stage checklist',
        body: 'Your quality description becomes a testable checklist in the deliver stage. "Clean formatting" becomes "use the standard template." "No calculation errors" becomes "verify against source data before sending." Turning aspirational quality into specific checks means the deliver stage consistently produces work at your standard — not just when you\'re paying close attention.'
      }
    }
  ],

  custom: [
    {
      id: 'what_you_do',
      type: 'textarea',
      label: 'What do you do in this workspace? What type of work happens here?',
      placeholder: 'e.g. I manage grant applications for nonprofits. Each application goes from research to writing to submission.',
      teaching: {
        title: 'Every workflow has layers',
        body: 'Whatever you do, the same three-layer principle applies: a map that tells Claude where everything is (CLAUDE.md), rooms that describe what happens in each area (workspace CONTEXT.md files), and tools or reference material that load when needed. The labels change. The structure is the same.'
      }
    },
    {
      id: 'stages',
      type: 'textarea',
      label: 'What are your 2–4 main stages of work? Name them and briefly describe each.',
      placeholder: 'e.g. Stage 1: Research — gather requirements and background.\nStage 2: Draft — write the content.\nStage 3: Review — check and revise.\nStage 4: Submit — finalize and deliver.',
      teaching: {
        title: 'How to find your stage boundaries',
        body: 'Ask yourself: when do I shift mental gears? Writing and reviewing are different mental modes. Research and writing are different. If you find yourself wishing the AI would "forget what it was just doing" and focus on something else — that\'s a stage boundary. Start with 2–3 stages. You can always add more when the workflow earns it.'
      }
    },
    {
      id: 'reference_material',
      type: 'textarea',
      label: 'What reference material stays the same across all your work in this workspace?',
      placeholder: 'e.g. Style guide, audience description, quality standards, templates I reuse, frameworks I always apply.',
      teaching: {
        title: 'Stable reference belongs at Layer 3',
        body: 'The 5-layer ICM system separates context by how often it changes. Your style guide changes rarely. Your current project source material changes every run. Keeping them in separate files means each layer only loads when its stage needs it. You stop burning tokens on information that has nothing to do with the current task.'
      }
    },
    {
      id: 'failure_modes',
      type: 'textarea',
      label: 'What goes wrong with this type of work? What do you want the system to prevent?',
      placeholder: 'e.g. Scope creep. Inconsistent quality. Starting build before requirements are clear. Missing the client\'s actual need.',
      teaching: {
        title: 'Design against failure modes',
        body: 'Every architectural decision should prevent a specific failure. Discovery as a separate stage prevents building before requirements are clear. A constraints file prevents AI writing patterns you dislike. Numbered stage folders prevent working out of order. Your failure modes are not obstacles — they\'re the requirements that shape your workspace.'
      }
    }
  ]
};

// Voice and constraints questions — asked for all archetypes after the archetype-specific ones
const VOICE_QUESTIONS = [
  {
    id: 'voice_patterns',
    type: 'textarea',
    label: 'Describe 3 patterns in your natural writing or communication style.',
    placeholder: 'e.g. 1. I start with the counterintuitive observation, then explain it.\n2. I use short sentences for emphasis after a longer one.\n3. I avoid jargon — I explain technical things in plain language.',
    hint: 'Not adjectives ("confident," "warm"). Actual patterns. How you move through ideas.',
    teaching: {
      title: 'Voice = conditions, not instructions',
      body: 'Telling Claude "be engaging and authoritative" produces generic output. Describing how you actually think and teach — "starts with what people think they know and peels it back" — produces specific output. The model figures out behavior from the environment you describe. You don\'t need to say "be thorough" if you\'ve described a thorough standard. If you\'re not sure, record yourself explaining something and read the transcript. That\'s your voice.'
    }
  },
  {
    id: 'writing_prohibitions',
    type: 'textarea',
    label: 'What AI writing patterns do you hate? What would make you immediately edit or reject a draft?',
    placeholder: 'e.g. Em dashes everywhere. "It\'s worth noting that..." Bullet points for everything. "Delve into." Summary paragraphs at the end that repeat what was just said.',
    hint: 'These become your constraints file — the cheapest and highest-impact file in the system.',
    teaching: {
      title: 'The never-do list compounds over time',
      body: 'Every time you see a pattern you dislike and think "Claude keeps doing this," that reaction is data. Add it to the constraints file. Over time, this file becomes a precise map of the gap between generic AI output and your standard. The vault toolkit starts you with a set of hard rules (no em dashes, no AI hedging, no significance inflation) — you add your own on top.'
    }
  },
  {
    id: 'team_size',
    type: 'radio',
    label: 'How many people will use this workspace?',
    options: ['Just me', '2–3 people', '4+ people'],
    teaching: {
      title: 'Team size affects handoff documentation',
      body: 'A solo workspace can carry institutional knowledge in your head — for now. A team workspace cannot. When multiple people use the same workspace, the stage contracts and CLAUDE.md need to answer questions without requiring a verbal walkthrough. The goal: someone should be able to clone the folder and start producing consistent output in under 5 minutes. If they need to ask you questions, there\'s documentation missing.'
    }
  }
];

// Stage configuration question — shown after archetype questions
const STAGE_CONFIG_QUESTION = {
  id: 'stage_config',
  type: 'stage_builder',
  label: 'Review and customize your workspace stages.',
  teaching: {
    title: 'Stages are numbered folders with output/ directories',
    body: 'Each stage gets a numbered folder (01_research, 02_script, 03_production). The number encodes execution order — you can see the workflow sequence just by looking at the folder. Each stage has a CONTEXT.md (its contract) and an output/ directory (its handoff point). Stage N\'s output is Stage N+1\'s input. Human review happens at each output/ directory before moving forward. This is how you catch drift before it compounds.'
  }
};

// Export everything
window.ICM = window.ICM || {};
window.ICM.ARCHETYPES = ARCHETYPES;
window.ICM.UNIVERSAL_QUESTIONS = UNIVERSAL_QUESTIONS;
window.ICM.ARCHETYPE_QUESTIONS = ARCHETYPE_QUESTIONS;
window.ICM.VOICE_QUESTIONS = VOICE_QUESTIONS;
window.ICM.STAGE_CONFIG_QUESTION = STAGE_CONFIG_QUESTION;
