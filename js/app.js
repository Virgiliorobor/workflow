// app.js — Wizard flow, state management, UI wiring

window.ICM = window.ICM || {};

window.ICM.app = (() => {

  // ── CONFIGURATION ──────────────────────────────────────────────────────────
  // Override by setting window.ICM_BACKEND_URL before this script loads
  const BACKEND_URL = (window.ICM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');

  // ── STATE ──────────────────────────────────────────────────────────────────

  let state = {
    screen: 'home',          // home | chat | wizard | results
    questionIndex: 0,
    questions: [],           // flat list of questions for current wizard run
    answers: {},             // accumulated wizard answers
    generatedFilesBase: {},  // pure generator output (no user edits)
    fileOverrides: {},       // user edits: { path: { content, updatedAt } }
    generatedFiles: {},      // computed final: base merged with overrides
    activeFile: null,        // currently previewed file path
    backendAvailable: null   // null = unknown, true/false after health check
  };

  function computeFinalFiles() {
    const final = Object.assign({}, state.generatedFilesBase);
    Object.entries(state.fileOverrides).forEach(([path, ov]) => {
      final[path] = ov.content;
    });
    state.generatedFiles = final;
  }

  function saveState() {
    try {
      // Only persist what needs to survive a page refresh; base files
      // are regenerated from answers on load.
      const toSave = {
        screen: state.screen,
        questionIndex: state.questionIndex,
        questions: state.questions,
        answers: state.answers,
        fileOverrides: state.fileOverrides,
        activeFile: state.activeFile
      };
      localStorage.setItem('icm_builder_state', JSON.stringify(toSave));
    } catch(e) {}
  }

  function loadSavedState() {
    try {
      const saved = localStorage.getItem('icm_builder_state');
      if (saved) {
        const p = JSON.parse(saved);
        state.screen = p.screen || 'home';
        state.questionIndex = p.questionIndex || 0;
        state.questions = p.questions || [];
        state.answers = p.answers || {};
        state.fileOverrides = p.fileOverrides || {};
        state.activeFile = p.activeFile || null;
      }
    } catch(e) {}
  }

  // ── QUESTION PIPELINE ──────────────────────────────────────────────────────

  function buildQuestionList(archetype) {
    const archetypeQs = window.ICM.ARCHETYPE_QUESTIONS[archetype] || window.ICM.ARCHETYPE_QUESTIONS.custom;
    return [
      ...window.ICM.UNIVERSAL_QUESTIONS,
      ...archetypeQs,
      window.ICM.STAGE_CONFIG_QUESTION,
      ...window.ICM.VOICE_QUESTIONS
    ];
  }

  // ── SCREEN ROUTING ─────────────────────────────────────────────────────────

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
    state.screen = name;
    saveState();
  }

  // ── HOME SCREEN ────────────────────────────────────────────────────────────

  function initHome() {
    document.getElementById('btn-new').addEventListener('click', () => {
      state.answers = {};
      state.fileOverrides = {};
      state.questionIndex = 0;
      showArchetypeSelection();
    });

    // Wire chat entry button — enabled/disabled by backend health check
    const chatBtn = document.getElementById('btn-chat');
    if (chatBtn) {
      chatBtn.addEventListener('click', () => {
        if (window.ICM.chat) window.ICM.chat.show();
      });
    }

    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('reopen-input');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) loadStateFile(file);
    });

    fileInput.addEventListener('change', e => {
      if (e.target.files[0]) loadStateFile(e.target.files[0]);
    });

    if (state.screen === 'wizard' && state.answers.archetype) {
      const resumeBanner = document.getElementById('resume-banner');
      if (resumeBanner) {
        resumeBanner.classList.remove('hidden');
        document.getElementById('btn-resume').addEventListener('click', () => {
          state.questions = buildQuestionList(state.answers.archetype);
          showScreen('wizard');
          renderQuestion();
        });
      }
    }
  }

  function loadStateFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const loaded = JSON.parse(e.target.result);
        // Support v2 format { answers, overrides } and v1 format (flat answers object)
        if (loaded.answers && typeof loaded.answers === 'object' && loaded.answers.project_name) {
          state.answers = loaded.answers;
          state.fileOverrides = loaded.overrides || {};
        } else if (loaded.project_name) {
          // Old v1 format — was just the answers object
          state.answers = loaded;
          state.fileOverrides = {};
        } else {
          throw new Error('Unrecognised format');
        }
        state.generatedFilesBase = window.ICM.generator.generateAllFiles(state.answers);
        computeFinalFiles();
        showScreen('results');
        renderResults();
      } catch(err) {
        showToast('Could not read file. Make sure it is a workspace-state.json file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ── ARCHETYPE SELECTION ────────────────────────────────────────────────────

  function showArchetypeSelection() {
    showScreen('wizard');
    const container = document.getElementById('wizard-content');
    container.innerHTML = `
      <div class="archetype-screen">
        <div class="wizard-header">
          <div class="step-badge">Step 1 of ${window.ICM.ARCHETYPES.length}</div>
          <h2>What type of workspace do you need?</h2>
          <p class="wizard-subtitle">Pick the closest match. You'll customize everything in the next steps.</p>
        </div>
        <div class="teaching-box">
          <div class="teaching-title">How the routing system works</div>
          <div class="teaching-body">The workspace blueprint has three layers. A <strong>CLAUDE.md</strong> that tells Claude where everything is (it reads this first, every session). <strong>Workspace context files</strong> that describe what happens in each area. And <strong>reference material</strong> that loads only when a stage needs it. The archetype determines what your stages are called and what they do — the three-layer structure stays the same for everyone.</div>
        </div>
        <div class="archetype-grid">
          ${window.ICM.ARCHETYPES.map(a => `
            <button class="archetype-card" data-archetype="${a.id}">
              <span class="archetype-icon">${a.icon}</span>
              <strong>${a.label}</strong>
              <span>${a.description}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.archetype-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const archetype = btn.dataset.archetype;
        state.answers.archetype = archetype;
        const archetypeObj = window.ICM.ARCHETYPES.find(a => a.id === archetype);
        state.answers.stages = archetypeObj.stageDefaults.map((slug, i) => ({
          id: String(i + 1).padStart(2, '0'),
          slug,
          label: archetypeObj.stageLabels[i],
          description: '',
          task: '',
          note: ''
        }));
        state.questions = buildQuestionList(archetype);
        state.questionIndex = 0;
        renderQuestion();
      });
    });
  }

  // ── WIZARD ─────────────────────────────────────────────────────────────────

  function renderQuestion() {
    const q = state.questions[state.questionIndex];
    if (!q) { finishWizard(); return; }

    const total = state.questions.length;
    const progress = Math.round(((state.questionIndex) / total) * 100);

    const container = document.getElementById('wizard-content');
    container.innerHTML = `
      <div class="question-screen">
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <div class="wizard-header">
          <div class="step-badge">Question ${state.questionIndex + 1} of ${total}</div>
          <h2>${q.label}</h2>
          ${q.hint ? `<p class="question-hint">${q.hint}</p>` : ''}
        </div>

        <div class="teaching-box">
          <div class="teaching-title">${q.teaching.title}</div>
          <div class="teaching-body">${q.teaching.body}</div>
        </div>

        <div class="question-input-area">
          ${renderInput(q)}
        </div>

        <div class="wizard-nav">
          <button class="btn-secondary" id="btn-back" ${state.questionIndex === 0 ? 'disabled' : ''}>
            ← Back
          </button>
          <button class="btn-primary" id="btn-next">
            ${state.questionIndex === total - 1 ? 'Generate Workspace →' : 'Next →'}
          </button>
        </div>
      </div>
    `;

    restoreInputValue(q);

    if (q.type === 'stage_builder') {
      initStageBuilder();
    }

    document.getElementById('btn-back').addEventListener('click', () => {
      state.questionIndex = Math.max(0, state.questionIndex - 1);
      renderQuestion();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      if (!saveAnswer(q)) return;
      state.questionIndex++;
      renderQuestion();
    });
  }

  function renderInput(q) {
    const val = state.answers[q.id] || '';

    switch(q.type) {
      case 'text':
        return `<input class="q-input" id="q-input" type="text" placeholder="${q.placeholder || ''}" value="${escHtml(val)}" autofocus>`;

      case 'textarea':
        return `<textarea class="q-input q-textarea" id="q-input" placeholder="${q.placeholder || ''}" autofocus>${escHtml(val)}</textarea>`;

      case 'radio':
        return `<div class="q-radio-group" id="q-input">
          ${q.options.map(opt => `
            <label class="q-radio-label ${val === opt ? 'selected' : ''}">
              <input type="radio" name="q_radio" value="${escHtml(opt)}" ${val === opt ? 'checked' : ''}>
              ${opt}
            </label>
          `).join('')}
        </div>`;

      case 'checkboxes': {
        const saved = Array.isArray(val) ? val : [];
        return `<div class="q-checkbox-grid" id="q-input">
          ${q.options.map(opt => `
            <label class="q-checkbox-label ${saved.includes(opt) ? 'selected' : ''}">
              <input type="checkbox" value="${escHtml(opt)}" ${saved.includes(opt) ? 'checked' : ''}>
              ${opt}
            </label>
          `).join('')}
        </div>`;
      }

      case 'stage_builder':
        return renderStageBuilderHTML();

      default:
        return `<input class="q-input" id="q-input" type="text" placeholder="${q.placeholder || ''}" value="${escHtml(val)}">`;
    }
  }

  function renderStageBuilderHTML() {
    const stages = state.answers.stages || [];
    return `
      <div class="stage-builder" id="q-input">
        <p class="stage-builder-intro">These are the stages of your workspace. Rename them to match your workflow. Add or remove stages (2–5 recommended). Each stage gets a numbered folder and a stage contract.<br><small style="color:var(--text3)">Task trigger: what you'd say to Claude to start that stage (populates the routing table).</small></p>
        <div class="stage-list" id="stage-list">
          ${stages.map((s, i) => renderStageRow(s, i, stages.length)).join('')}
        </div>
        <button class="btn-add-stage" id="btn-add-stage" ${stages.length >= 5 ? 'disabled' : ''}>
          + Add Stage
        </button>
      </div>
    `;
  }

  function renderStageRow(stage, index, totalStages) {
    return `
      <div class="stage-row" data-index="${index}">
        <span class="stage-num">${String(index + 1).padStart(2, '0')}</span>
        <input class="stage-name-input" type="text" placeholder="Stage name" value="${escHtml(stage.label)}" data-field="label">
        <input class="stage-slug-input" type="text" placeholder="folder-name" value="${escHtml(stage.slug)}" data-field="slug">
        <input class="stage-desc-input" type="text" placeholder="One sentence: what happens here?" value="${escHtml(stage.description || '')}" data-field="description">
        <button class="btn-remove-stage" data-index="${index}" ${totalStages <= 2 ? 'disabled' : ''} title="Remove stage">×</button>
        <input class="stage-task-input" type="text" placeholder="Task trigger — e.g. "Start research phase"" value="${escHtml(stage.task || '')}" data-field="task">
        <input class="stage-note-input" type="text" placeholder="Routing note (optional)" value="${escHtml(stage.note || '')}" data-field="note">
      </div>
    `;
  }

  function rerenderStageBuilder() {
    const el = document.getElementById('q-input');
    if (!el) return;
    el.outerHTML = renderStageBuilderHTML();
    initStageBuilder();
  }

  function initStageBuilder() {
    const container = document.getElementById('stage-list');
    if (!container) return;

    container.addEventListener('input', e => {
      const row = e.target.closest('.stage-row');
      if (!row) return;
      const index = parseInt(row.dataset.index);
      const field = e.target.dataset.field;
      if (!state.answers.stages[index]) return;

      if (field === 'label') {
        state.answers.stages[index].label = e.target.value;
        const slugInput = row.querySelector('.stage-slug-input');
        if (slugInput && !slugInput.dataset.manuallyEdited) {
          const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          slugInput.value = slug;
          state.answers.stages[index].slug = slug;
        }
      }
      if (field === 'slug') {
        e.target.dataset.manuallyEdited = 'true';
        state.answers.stages[index].slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
        e.target.value = state.answers.stages[index].slug;
      }
      if (field === 'description') state.answers.stages[index].description = e.target.value;
      if (field === 'task') state.answers.stages[index].task = e.target.value;
      if (field === 'note') state.answers.stages[index].note = e.target.value;

      saveState();
    });

    container.addEventListener('click', e => {
      const removeBtn = e.target.closest('.btn-remove-stage');
      if (!removeBtn) return;
      const index = parseInt(removeBtn.dataset.index);
      if (state.answers.stages.length <= 2) {
        showToast('You need at least 2 stages.', 'warning');
        return;
      }
      state.answers.stages.splice(index, 1);
      state.answers.stages.forEach((s, i) => { s.id = String(i + 1).padStart(2, '0'); });
      rerenderStageBuilder();
      saveState();
    });

    document.getElementById('btn-add-stage')?.addEventListener('click', () => {
      if (state.answers.stages.length >= 5) return;
      const num = state.answers.stages.length + 1;
      state.answers.stages.push({
        id: String(num).padStart(2, '0'),
        slug: `stage-${num}`,
        label: `Stage ${num}`,
        description: '',
        task: '',
        note: ''
      });
      rerenderStageBuilder();
      saveState();
    });
  }

  function saveAnswer(q) {
    if (q.type === 'stage_builder') {
      const stages = state.answers.stages || [];
      const invalid = stages.some(s => !s.label.trim() || !s.slug.trim());
      if (invalid) {
        showToast('Please give each stage a name and folder name.', 'warning');
        return false;
      }
      return true;
    }

    if (q.type === 'radio') {
      const checked = document.querySelector('input[name="q_radio"]:checked');
      if (!checked && q.required) {
        showToast('Please select an option.', 'warning');
        return false;
      }
      state.answers[q.id] = checked ? checked.value : '';
    } else if (q.type === 'checkboxes') {
      const checked = [...document.querySelectorAll('#q-input input[type="checkbox"]:checked')].map(cb => cb.value);
      state.answers[q.id] = checked;
    } else {
      const input = document.getElementById('q-input');
      if (!input) return true;
      const val = input.value.trim();
      if (q.id === 'project_name') {
        const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!slug) {
          showToast('Please enter a project name.', 'warning');
          return false;
        }
        state.answers[q.id] = slug;
      } else {
        state.answers[q.id] = val;
      }
    }

    saveState();
    return true;
  }

  function restoreInputValue(q) {
    if (q.type === 'stage_builder' || q.type === 'radio' || q.type === 'checkboxes') return;
    const input = document.getElementById('q-input');
    if (input && state.answers[q.id]) {
      input.value = state.answers[q.id];
    }
    document.querySelectorAll('.q-radio-label input').forEach(inp => {
      inp.addEventListener('change', () => {
        document.querySelectorAll('.q-radio-label').forEach(l => l.classList.remove('selected'));
        inp.closest('.q-radio-label').classList.add('selected');
      });
    });
    document.querySelectorAll('.q-checkbox-label input').forEach(inp => {
      inp.addEventListener('change', () => {
        inp.closest('.q-checkbox-label').classList.toggle('selected', inp.checked);
      });
    });
  }

  // ── ENTER WIZARD FROM CHAT (pre-filled) ───────────────────────────────────

  function enterWizardWithAnswers(answers) {
    const validArchetypes = new Set(['content', 'freelancer', 'developer', 'smallbiz', 'custom']);
    if (!validArchetypes.has(answers.archetype)) answers.archetype = 'custom';

    // Normalise stages: ensure correct ids and safe slugs
    if (Array.isArray(answers.stages)) {
      answers.stages = answers.stages.map((s, i) => ({
        id: String(i + 1).padStart(2, '0'),
        slug: (s.slug || `stage-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '') || `stage-${i + 1}`,
        label: s.label || `Stage ${i + 1}`,
        description: s.description || '',
        task: s.task || '',
        note: s.note || ''
      }));
    } else {
      answers.stages = [];
    }

    state.answers = answers;
    state.fileOverrides = {};
    state.questions = buildQuestionList(answers.archetype);
    state.questionIndex = 0;
    showScreen('wizard');
    renderQuestion();
  }

  // ── FINISH WIZARD ──────────────────────────────────────────────────────────

  function finishWizard() {
    state.fileOverrides = {};  // clear any previous overrides on a fresh generation
    state.generatedFilesBase = window.ICM.generator.generateAllFiles(state.answers);
    computeFinalFiles();
    showScreen('results');
    renderResults();
  }

  // ── RESULTS SCREEN ─────────────────────────────────────────────────────────

  function renderResults() {
    const { project_name } = state.answers;

    window._icmCurrentAnswers = state.answers;

    document.getElementById('results-title').textContent = project_name;

    // Ensure listeners are not duplicated on edit+regen cycles
    [document.getElementById('btn-download'),
     document.getElementById('btn-edit'),
     document.getElementById('btn-home')].forEach(btn => {
      if (btn) btn.replaceWith(btn.cloneNode(true));
    });
    document.getElementById('btn-download').addEventListener('click', downloadZip);
    document.getElementById('btn-home').addEventListener('click', () => showScreen('home'));
    document.getElementById('btn-edit').addEventListener('click', () => {
      state.questionIndex = 0;
      state.questions = buildQuestionList(state.answers.archetype);
      showScreen('wizard');
      renderQuestion();
    });

    // AI improve button
    const actionsEl = document.querySelector('.results-actions');
    const existingAiBtn = document.getElementById('btn-ai-improve');
    if (existingAiBtn) existingAiBtn.remove();
    const aiBtn = document.createElement('button');
    aiBtn.id = 'btn-ai-improve';
    aiBtn.className = 'btn-ai-improve';
    if (state.backendAvailable === false) {
      aiBtn.disabled = true;
      aiBtn.title = 'AI backend not running. Start backend/app.py to enable.';
    }
    aiBtn.innerHTML = `✦ Improve with AI`;
    aiBtn.addEventListener('click', showAIImproveFlow);
    actionsEl.insertBefore(aiBtn, document.getElementById('btn-download'));

    if (state.backendAvailable === null) {
      checkBackendHealth().then(available => {
        aiBtn.disabled = !available;
        aiBtn.title = available ? '' : 'AI backend not running. Start backend/app.py to enable.';
      });
    }

    renderFileTree();
    renderSkillsUploadSection();
  }

  // ── FILE TREE ──────────────────────────────────────────────────────────────

  function renderFileTree() {
    const tree = document.getElementById('file-tree');
    if (!tree) return;

    // Rebuild tree header with skill upload button
    const panel = document.querySelector('.file-tree-panel');
    let header = panel.querySelector('.file-tree-header');
    if (!header) {
      const oldLabel = panel.querySelector('.file-tree-label');
      header = document.createElement('div');
      header.className = 'file-tree-header';
      header.innerHTML = `
        <span class="file-tree-label" style="padding:0;margin:0">Generated Files</span>
        <div style="display:flex;gap:5px">
          <button class="btn-skill-upload" id="btn-skill-creator" title="Create a new skill file">✦ Skill</button>
          <button class="btn-skill-upload" id="btn-skill-upload" title="Upload .md skill files">↑ Import</button>
        </div>
      `;
      if (oldLabel) oldLabel.replaceWith(header);
      header.querySelector('#btn-skill-creator').addEventListener('click', showSkillCreatorModal);
      header.querySelector('#btn-skill-upload').addEventListener('click', triggerSkillUpload);
    }

    const files = state.generatedFiles;
    const paths = Object.keys(files).sort();

    const root = {};
    paths.forEach(p => {
      const parts = p.split('/');
      let node = root;
      parts.forEach((part, i) => {
        if (!node[part]) node[part] = i === parts.length - 1 ? null : {};
        if (i < parts.length - 1) node = node[part];
      });
    });

    tree.innerHTML = renderTreeNode(root, '', 0);

    tree.querySelectorAll('.file-item').forEach(el => {
      el.addEventListener('click', () => highlightFile(el.dataset.path));
    });
  }

  function renderTreeNode(node, prefix, depth) {
    if (node === null) return '';
    return Object.entries(node).map(([name, children]) => {
      const isDir = children !== null && typeof children === 'object';
      const path = prefix ? `${prefix}/${name}` : name;
      const indent = depth * 16;
      if (isDir) {
        return `
          <div class="tree-dir" style="padding-left:${indent}px">
            <span class="tree-icon dir-icon">📁</span>
            <span class="dir-name">${name}/</span>
          </div>
          ${renderTreeNode(children, path, depth + 1)}
        `;
      } else {
        const icon = name.endsWith('.md') ? '📄' : name.endsWith('.json') ? '{}' : '·';
        const layer = getFileLayer(name, path);
        const isOverridden = !!state.fileOverrides[path];
        return `
          <div class="file-item${isOverridden ? ' has-override' : ''}" data-path="${path}" style="padding-left:${indent + 16}px">
            ${isOverridden ? '<span class="override-dot"></span>' : ''}
            <span class="tree-icon">${icon}</span>
            <span class="file-name">${name}</span>
            ${layer ? `<span class="layer-badge layer-${layer.toLowerCase().replace(' ','')}">${layer}</span>` : ''}
          </div>
        `;
      }
    }).join('');
  }

  function getFileLayer(name, path) {
    if (name === 'CLAUDE.md') return 'L0';
    if (name === 'CONTEXT.md' && !path.includes('/0')) return 'L1';
    if (name === 'CONTEXT.md' && /\/0\d_/.test(path)) return 'L2';
    if (path.includes('_config/')) return 'L3';
    if (path.includes('/output/')) return 'L4';
    if (path.includes('skill-starters/')) return 'L5';
    return '';
  }

  // ── FILE PREVIEW & LIVE EDITING ────────────────────────────────────────────

  function highlightFile(path) {
    state.activeFile = path;

    document.querySelectorAll('.file-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === path);
    });

    const preview = document.getElementById('file-preview');
    if (!preview) return;

    const baseContent = state.generatedFilesBase[path];
    const override = state.fileOverrides[path];
    const content = override ? override.content : baseContent;

    if (content === undefined && !Object.prototype.hasOwnProperty.call(state.generatedFiles, path)) {
      preview.innerHTML = '<div class="preview-empty">File not found.</div>';
      return;
    }
    if (content === '') {
      preview.innerHTML = '<div class="preview-empty">(empty — placeholder file)</div>';
      return;
    }

    const isEditable = path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.json');
    const hasOverride = !!override;

    renderPreviewView(preview, path, content, isEditable, hasOverride);
  }

  function renderPreviewView(preview, path, content, isEditable, hasOverride) {
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    preview.innerHTML = `
      <div class="preview-header">
        <span class="preview-path">${path}</span>
        <div class="preview-actions">
          <button class="btn-copy-file" data-path="${path}">Copy</button>
          ${isEditable ? `<button class="btn-edit-file">Edit</button>` : ''}
          ${hasOverride ? `<button class="btn-reset-file">Reset to generated</button>` : ''}
        </div>
      </div>
      ${hasOverride ? `<div class="override-notice">✎ Manually edited — this version will be used in the ZIP export.</div>` : ''}
      <pre class="preview-code">${escaped}</pre>
    `;

    preview.querySelector('.btn-copy-file')?.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => showToast('Copied to clipboard'));
    });

    preview.querySelector('.btn-edit-file')?.addEventListener('click', () => {
      renderPreviewEditor(preview, path, content);
    });

    preview.querySelector('.btn-reset-file')?.addEventListener('click', () => {
      delete state.fileOverrides[path];
      computeFinalFiles();
      saveState();
      const newContent = state.generatedFilesBase[path] || '';
      renderPreviewView(preview, path, newContent, isEditable, false);
      // Refresh tree to remove dot
      renderFileTree();
      // Re-select the same file
      document.querySelectorAll('.file-item').forEach(el => {
        el.classList.toggle('active', el.dataset.path === path);
      });
      showToast('Reverted to generated version');
    });
  }

  function renderPreviewEditor(preview, path, content) {
    preview.innerHTML = `
      <div class="preview-header">
        <span class="preview-path">${path}</span>
        <div class="preview-actions">
          <button class="btn-save-edit">Save</button>
          <button class="btn-cancel-edit">Cancel</button>
        </div>
      </div>
      <div class="preview-editor-wrap">
        <textarea class="preview-editor" id="live-editor" spellcheck="false">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      </div>
    `;

    // Ensure textarea content isn't HTML-escaped (we want raw content in textarea)
    const ta = document.getElementById('live-editor');
    if (ta) ta.value = content;

    preview.querySelector('.btn-save-edit').addEventListener('click', () => {
      const newContent = document.getElementById('live-editor')?.value ?? '';
      state.fileOverrides[path] = { content: newContent, updatedAt: new Date().toISOString() };
      computeFinalFiles();
      saveState();
      renderPreviewView(preview, path, newContent, true, true);
      renderFileTree();
      document.querySelectorAll('.file-item').forEach(el => {
        el.classList.toggle('active', el.dataset.path === path);
      });
      showToast('File saved — override active');
    });

    preview.querySelector('.btn-cancel-edit').addEventListener('click', () => {
      const override = state.fileOverrides[path];
      const displayContent = override ? override.content : (state.generatedFilesBase[path] || '');
      const isEditable = path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.json');
      renderPreviewView(preview, path, displayContent, isEditable, !!override);
    });

    // Focus and place cursor at end
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }

  // ── SKILL CREATOR MODAL ────────────────────────────────────────────────────

  function showSkillCreatorModal() {
    const overlay = document.createElement('div');
    overlay.className = 'ai-modal-overlay';
    overlay.innerHTML = `
      <div class="ai-modal" style="max-width:560px">
        <div class="ai-modal-header">
          <h3>Create a Skill Starter</h3>
          <button id="sc-close" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:0 4px">×</button>
        </div>
        <div class="ai-modal-body" style="display:flex;flex-direction:column;gap:14px">
          <p style="font-size:12px;color:var(--text2);margin:0">A skill starter is a reusable prompt template for a specific type of task. It loads the right context files and gives Claude a structured starting point every time.</p>

          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">SKILL NAME <span style="color:var(--red)">*</span></label>
            <input id="sc-name" class="q-input" type="text" placeholder="e.g. Draft YouTube script, Review client proposal" style="font-size:13px;padding:9px 12px;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">WHAT DOES THIS SKILL DO?</label>
            <textarea id="sc-purpose" class="q-input q-textarea" placeholder="e.g. Start the script-writing stage with the right context — reads research output and applies voice/format patterns." style="font-size:13px;padding:9px 12px;min-height:70px;width:100%"></textarea>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">TRIGGER PHRASE <span style="color:var(--text3)">(what you'd say to start it)</span></label>
            <input id="sc-trigger" class="q-input" type="text" placeholder="e.g. Write the script for [topic] using the research in 02_script/output/" style="font-size:13px;padding:9px 12px;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">FILES TO READ FIRST <span style="color:var(--text3)">(one per line)</span></label>
            <textarea id="sc-reads" class="q-input q-textarea" placeholder="CLAUDE.md&#10;01_research/CONTEXT.md&#10;_config/voice-and-tone.md" style="font-size:13px;padding:9px 12px;min-height:70px;width:100%;font-family:monospace"></textarea>
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">OUTPUT DESCRIPTION</label>
            <input id="sc-output" class="q-input" type="text" placeholder="e.g. A complete script in output/ ready for production" style="font-size:13px;padding:9px 12px;width:100%">
          </div>
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text3);display:block;margin-bottom:5px">CONSTRAINTS / SAFETY RULES <span style="color:var(--text3)">(one per line, optional)</span></label>
            <textarea id="sc-constraints" class="q-input q-textarea" placeholder="Always load _config/constraints.md&#10;Do not invent facts not in the research output" style="font-size:13px;padding:9px 12px;min-height:60px;width:100%"></textarea>
          </div>
        </div>
        <div class="ai-modal-footer">
          <button class="btn-secondary" id="sc-cancel">Cancel</button>
          <button class="btn-secondary" id="sc-improve" title="${state.backendAvailable ? 'Improve fields with AI' : 'Backend not running'}"\
            ${state.backendAvailable ? '' : 'disabled'} style="display:flex;align-items:center;gap:6px">
            ✦ Improve with AI
          </button>
          <button class="btn-primary" id="sc-create">Create Skill File →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#sc-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#sc-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#sc-improve').addEventListener('click', async () => {
      const name = overlay.querySelector('#sc-name').value.trim();
      if (!name) { showToast('Please enter a skill name first.', 'warning'); return; }

      const improveBtn = overlay.querySelector('#sc-improve');
      const originalLabel = improveBtn.innerHTML;
      improveBtn.disabled = true;
      improveBtn.innerHTML = '<span class="ai-spinner"></span> Improving…';

      const readsRaw = overlay.querySelector('#sc-reads').value.trim();
      const constraintsRaw = overlay.querySelector('#sc-constraints').value.trim();

      const payload = {
        name,
        purpose:     overlay.querySelector('#sc-purpose').value.trim(),
        trigger:     overlay.querySelector('#sc-trigger').value.trim(),
        reads:       readsRaw ? readsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [],
        output:      overlay.querySelector('#sc-output').value.trim(),
        constraints: constraintsRaw ? constraintsRaw.split('\n').map(l => l.trim()).filter(Boolean) : [],
        archetype:   state.answers.archetype || 'custom',
        stages:      (state.answers.stages || []).map(s => ({ label: s.label, slug: s.slug })),
        project_name: state.answers.project_name || '',
      };

      try {
        const BACKEND = (window.ICM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
        const res = await fetch(`${BACKEND}/api/improve-skill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || res.statusText);
        }
        const data = await res.json();

        overlay.querySelector('#sc-purpose').value   = data.purpose || '';
        overlay.querySelector('#sc-trigger').value   = data.trigger || '';
        overlay.querySelector('#sc-reads').value     = (data.reads || []).join('\n');
        overlay.querySelector('#sc-output').value    = data.output || '';
        overlay.querySelector('#sc-constraints').value = (data.constraints || []).join('\n');

        showToast('Skill fields improved with AI. Review and create.', 'success');
      } catch (err) {
        showToast(`AI improve failed: ${err.message}`, 'error');
      } finally {
        improveBtn.disabled = false;
        improveBtn.innerHTML = originalLabel;
      }
    });

    overlay.querySelector('#sc-create').addEventListener('click', () => {
      const name = overlay.querySelector('#sc-name').value.trim();
      if (!name) { showToast('Please enter a skill name.', 'warning'); return; }

      const purpose = overlay.querySelector('#sc-purpose').value.trim();
      const trigger = overlay.querySelector('#sc-trigger').value.trim();
      const readsRaw = overlay.querySelector('#sc-reads').value.trim();
      const output = overlay.querySelector('#sc-output').value.trim();
      const constraintsRaw = overlay.querySelector('#sc-constraints').value.trim();

      const reads = readsRaw
        ? readsRaw.split('\n').filter(l => l.trim()).map(l => `- \`${l.trim()}\``).join('\n')
        : '- `CLAUDE.md`';
      const constraints = constraintsRaw
        ? constraintsRaw.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`).join('\n')
        : '- Load `_config/constraints.md` in any stage that produces written output.';

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const content = buildSkillFileContent({ name, purpose, trigger, reads, output, constraints });
      const project = state.answers.project_name || 'workspace';
      const path = `${project}/skill-starters/${slug}.md`;

      state.fileOverrides[path] = { content, updatedAt: new Date().toISOString() };
      state.generatedFilesBase[path] = content;
      computeFinalFiles();
      saveState();
      overlay.remove();
      renderFileTree();
      highlightFile(path);
      showToast(`Skill "${name}" created in skill-starters/`);
    });
  }

  function buildSkillFileContent({ name, purpose, trigger, reads, output, constraints }) {
    const date = new Date().toISOString().split('T')[0];
    return `# Skill: ${name}

<!--
ICM Layer: L5 — skill starter.
A reusable prompt template for this specific type of task.
Load this when you want to start this work in a consistent, repeatable way.
Created: ${date}
-->

## Purpose
${purpose || 'Start this task in a consistent, repeatable way.'}

## When to use
Say something like: **"${trigger || `Start ${name.toLowerCase()}`}"**

## Read first
${reads}

## Prompt template

### Context
- Objective: [what you want to achieve in this session]
- Constraints: [any task-specific constraints beyond the defaults]
- Inputs: [files, links, or notes to use as source material]

## Task
Do the work described in the skill's purpose. Follow the relevant stage contract. \
Check your output against _config/constraints.md before finishing.

## Output requirements
${output ? `- ${output}` : '- Write output to the relevant stage output/ directory.'}
- Include a short completion note: what was done + any open questions.

## Safety rules
${constraints}

---
*ICM Skill Starter — created with ICM Workspace Builder*
`;
  }

  // ── SKILLS UPLOAD ──────────────────────────────────────────────────────────

  function renderSkillsUploadSection() {
    // Hidden file input for skill uploads (reused across clicks)
    let input = document.getElementById('skill-upload-input');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'skill-upload-input';
      input.accept = '.md,.txt';
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', handleSkillUpload);
    }
  }

  function triggerSkillUpload() {
    document.getElementById('skill-upload-input')?.click();
  }

  function handleSkillUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const project = state.answers.project_name || 'workspace';
    let loaded = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = evt => {
        const content = evt.target.result;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${project}/skill-starters/imported/${safeName}`;
        state.fileOverrides[path] = { content, updatedAt: new Date().toISOString() };
        // Also add to base so it appears in the tree
        state.generatedFilesBase[path] = content;
        computeFinalFiles();
        loaded++;
        if (loaded === files.length) {
          saveState();
          renderFileTree();
          showToast(`${loaded} skill${loaded > 1 ? 's' : ''} added to skill-starters/imported/`);
        }
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  }

  // ── AI IMPROVE FLOW ────────────────────────────────────────────────────────

  async function checkBackendHealth() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
      state.backendAvailable = res.ok;
    } catch {
      state.backendAvailable = false;
    }
    return state.backendAvailable;
  }

  function showAIImproveFlow() {
    if (state.backendAvailable === false) {
      showToast('AI backend is not available. Start backend/app.py first.', 'error');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ai-modal-overlay';
    overlay.id = 'ai-modal-overlay';
    overlay.innerHTML = `
      <div class="ai-modal">
        <div class="ai-modal-header">
          <h3>✦ Improve with AI</h3>
          <button id="ai-modal-close" style="background:none;border:none;color:var(--text2);font-size:20px;cursor:pointer;padding:0 4px">×</button>
        </div>
        <div class="ai-modal-body">
          <div class="ai-spinner">
            <div class="spinner-ring"></div>
            Sending workspace spec to Claude — this takes 10–20 seconds…
          </div>
        </div>
        <div class="ai-modal-footer" id="ai-modal-footer" style="display:none"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#ai-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Fire the request
    const payload = {
      answers: state.answers
    };

    fetch(`${BACKEND_URL}/api/improve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) return res.json().then(d => { throw new Error(d.detail || `HTTP ${res.status}`); });
      return res.json();
    })
    .then(data => renderAIImproveResult(overlay, data))
    .catch(err => renderAIImproveError(overlay, err.message));
  }

  function renderAIImproveResult(overlay, data) {
    const { improvedAnswers, changeLog, warnings } = data;
    const body = overlay.querySelector('.ai-modal-body');
    const footer = overlay.querySelector('#ai-modal-footer');

    const items = (changeLog || []).map(entry => `
      <div class="change-item ${entry.type || ''}">
        <div class="change-item-label">${escHtml(entry.field || 'general')}</div>
        ${escHtml(entry.message || '')}
      </div>
    `).join('') || '<p style="color:var(--text2);font-size:13px">No changes detected — your spec is already well-formed.</p>';

    body.innerHTML = `
      <p style="font-size:13px;color:var(--text2);margin-bottom:16px">Claude reviewed your workspace spec and suggested the following improvements. Accept to regenerate all files.</p>
      <div class="change-log">${items}</div>
      ${warnings && warnings.length ? `<div class="ai-warn">⚠ ${warnings.map(escHtml).join(' • ')}</div>` : ''}
    `;

    footer.style.display = 'flex';
    footer.innerHTML = `
      <button class="btn-secondary" id="ai-reject-btn">Reject — keep original</button>
      <button class="btn-primary" id="ai-accept-btn">Accept improvements →</button>
    `;

    footer.querySelector('#ai-reject-btn').addEventListener('click', () => overlay.remove());

    footer.querySelector('#ai-accept-btn').addEventListener('click', () => {
      overlay.remove();
      applyAIImprovements(improvedAnswers);
    });
  }

  function renderAIImproveError(overlay, message) {
    const body = overlay.querySelector('.ai-modal-body');
    const footer = overlay.querySelector('#ai-modal-footer');
    body.innerHTML = `
      <p style="font-size:14px;color:var(--red);margin-bottom:8px">AI improvement failed</p>
      <p style="font-size:13px;color:var(--text2)">${escHtml(message)}</p>
    `;
    footer.style.display = 'flex';
    footer.innerHTML = `<button class="btn-secondary" id="ai-close-err">Close</button>`;
    footer.querySelector('#ai-close-err').addEventListener('click', () => overlay.remove());
  }

  function applyAIImprovements(improvedAnswers) {
    const savedOverrides = Object.assign({}, state.fileOverrides);
    state.answers = improvedAnswers;
    state.generatedFilesBase = window.ICM.generator.generateAllFiles(state.answers);
    // Re-apply overrides (user edits survive regeneration)
    state.fileOverrides = savedOverrides;
    computeFinalFiles();
    saveState();
    // Update answers in global reference
    window._icmCurrentAnswers = state.answers;
    renderFileTree();
    // Refresh title
    document.getElementById('results-title').textContent = state.answers.project_name;
    // Reset diagram
    if (window.ICM.diagram) window.ICM.diagram.destroy('diagram-container');
    showToast('Workspace improved — files regenerated with your overrides preserved');
  }

  // ── ZIP DOWNLOAD ───────────────────────────────────────────────────────────

  async function downloadZip() {
    if (typeof JSZip === 'undefined') {
      showToast('JSZip not loaded. Check your internet connection.', 'error');
      return;
    }

    const zip = new JSZip();

    // Use final merged files
    const finalFiles = Object.assign({}, state.generatedFiles);

    // Override workspace-state.json with v2 format that includes overrides
    const stateFilePath = `${state.answers.project_name}/workspace-state.json`;
    finalFiles[stateFilePath] = JSON.stringify({
      answers: state.answers,
      overrides: state.fileOverrides
    }, null, 2);

    Object.entries(finalFiles).forEach(([path, content]) => {
      zip.file(path, content);
    });

    const btn = document.getElementById('btn-download');
    if (btn) { btn.textContent = 'Generating…'; btn.disabled = true; }

    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.answers.project_name || 'workspace'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Workspace downloaded!');
    } catch(err) {
      showToast('Download failed. Try again.', 'error');
    } finally {
      if (btn) { btn.textContent = '⬇ Download Workspace (.zip)'; btn.disabled = false; }
    }
  }

  // ── UTILS ──────────────────────────────────────────────────────────────────

  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── INIT ───────────────────────────────────────────────────────────────────

  function init() {
    loadSavedState();
    initHome();

    if (state.screen === 'results' && Object.keys(state.answers).length > 0) {
      try {
        state.generatedFilesBase = window.ICM.generator.generateAllFiles(state.answers);
        computeFinalFiles();
        showScreen('results');
        renderResults();
        return;
      } catch(e) {}
    }

    showScreen('home');

    // Run backend health check on startup so the chat button reflects availability
    checkBackendHealth().then(available => {
      updateChatEntryButton(available);
    });
  }

  function updateChatEntryButton(available) {
    const btn = document.getElementById('btn-chat');
    if (!btn) return;
    btn.disabled = !available;
    btn.title = available
      ? ''
      : 'AI backend not running. Start backend/app.py to enable.';
  }

  // Public API — enterWizardWithAnswers is used by chat.js
  return { init, highlightFile, showToast, enterWizardWithAnswers };
})();

document.addEventListener('DOMContentLoaded', () => window.ICM.app.init());
