// chat.js — Conversational entry point: describe your project, Claude pre-fills the wizard
// Public API via window.ICM.chat: show(), back(), send(), applyAnswers(), init()

window.ICM = window.ICM || {};

window.ICM.chat = (() => {

  const BACKEND_URL = (typeof window.ICM_resolveBackendUrl === 'function'
    ? window.ICM_resolveBackendUrl()
    : (window.ICM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, ''));
  const MAX_ROUNDS = 3;
  const MAX_ATTACH_FILES = 8;
  const MAX_FILE_BYTES = 4 * 1024 * 1024;
  /** Total characters for message + all attachments (rough guard for API limits). */
  const MAX_MESSAGE_CHARS = 95000;
  const MAX_PER_FILE_CHARS = 38000;

  const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.log', '.yaml', '.yml', '.xml', '.html', '.htm', '.svg', '.css', '.js', '.ts', '.tsx', '.jsx', '.env', '.sh', '.ps1', '.py', '.sql'
  ]);

  // Messages sent to/from the API (not including the hardcoded greeting)
  // Always starts with a user message; alternates user/assistant.
  let messages = [];
  let currentRound = 0;
  let isSending = false;
  /** Increments per assistant bubble for terminal-style labels */
  let assistantBubbleCount = 0;
  /** Pending files shown as chips; merged into the next user message as text. */
  let pendingAttachments = [];

  function toast(msg, variant) {
    if (window.ICM.app && window.ICM.app.showToast) {
      window.ICM.app.showToast(msg, variant || 'info');
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isAllowedFile(file) {
    const name = file.name.toLowerCase();
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    if (TEXT_EXTENSIONS.has(ext)) return true;
    const t = (file.type || '').toLowerCase();
    if (t.startsWith('text/')) return true;
    if (t === 'application/json' || t === 'application/xml') return true;
    return false;
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result != null ? fr.result : ''));
      fr.onerror = () => reject(new Error('Could not read file'));
      fr.readAsText(file, 'UTF-8');
    });
  }

  function renderAttachmentChips() {
    const el = document.getElementById('chat-attachments');
    if (!el) return;
    if (!pendingAttachments.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = pendingAttachments
      .map(
        (a, i) =>
          `<span class="chat-attach-chip"><span>${escapeHtml(a.name)}</span><button type="button" class="chat-attach-remove" data-attach-index="${i}" aria-label="Remove ${escapeHtml(a.name)}">×</button></span>`
      )
      .join('');
  }

  async function addFilesFromList(fileList) {
    const files = [...fileList];
    for (const file of files) {
      if (pendingAttachments.length >= MAX_ATTACH_FILES) {
        toast(`Maximum ${MAX_ATTACH_FILES} files per send.`, 'warning');
        break;
      }
      if (!isAllowedFile(file)) {
        toast(`Skipped "${file.name}" — use text-based files (.txt, .md, .json, …). PDF and Word need a future server step.`, 'warning');
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast(`"${file.name}" is too large (max 4 MB per file).`, 'warning');
        continue;
      }
      try {
        const text = await readFileAsText(file);
        pendingAttachments.push({ name: file.name, text });
      } catch {
        toast(`Could not read "${file.name}".`, 'error');
      }
    }
    renderAttachmentChips();
  }

  /** Full string sent to the API; may include fenced attachment bodies. */
  function buildUserPayload(userText) {
    const trimmed = (userText || '').trim();
    let body =
      trimmed ||
      '(The user sent only attached files below — infer their project/workflow from the documents and ask a short follow-up if anything critical is missing.)';

    if (pendingAttachments.length === 0) {
      if (body.length > MAX_MESSAGE_CHARS) {
        toast('Message is too long. Shorten your text before sending.', 'warning');
        return null;
      }
      return body;
    }

    body += '\n\n--- Attached documents (plain text) ---\n';
    for (const a of pendingAttachments) {
      let chunk = a.text;
      if (chunk.length > MAX_PER_FILE_CHARS) {
        chunk =
          chunk.slice(0, MAX_PER_FILE_CHARS) +
          '\n… [truncated: file exceeds per-send limit; split or send a shorter excerpt.]';
      }
      body += `\n### File: ${a.name}\n\`\`\`\n${chunk}\n\`\`\`\n`;
      if (body.length > MAX_MESSAGE_CHARS) {
        toast('Combined message + attachments exceeds the safe limit. Remove a file or shorten text.', 'warning');
        return null;
      }
    }
    return body;
  }

  /** Shorter text shown in the user bubble (not the full attachment dump). */
  function buildUserBubblePreview(userText) {
    const trimmed = (userText || '').trim();
    const names = pendingAttachments.map(a => a.name);
    if (trimmed && names.length) {
      return `${trimmed}\n\n(Attached: ${names.join(', ')})`;
    }
    if (trimmed) return trimmed;
    if (names.length) return '(Attached files only)\n' + names.map(n => `• ${n}`).join('\n');
    return '';
  }

  function wireAttachmentUi() {
    const attachBtn = document.getElementById('chat-attach-btn');
    const fileInput = document.getElementById('chat-file-input');
    const attachHost = document.getElementById('chat-attachments');

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', e => {
        const fl = e.target.files;
        if (fl && fl.length) addFilesFromList(fl);
        e.target.value = '';
      });
    }

    if (attachHost) {
      attachHost.addEventListener('click', e => {
        const btn = e.target.closest('.chat-attach-remove');
        if (!btn) return;
        const i = parseInt(btn.getAttribute('data-attach-index'), 10);
        if (!Number.isNaN(i)) {
          pendingAttachments.splice(i, 1);
          renderAttachmentChips();
        }
      });
    }
  }

  // ── PUBLIC: show ───────────────────────────────────────────────────────────

  function show() {
    messages = [];
    currentRound = 0;
    isSending = false;
    assistantBubbleCount = 0;
    pendingAttachments = [];
    renderAttachmentChips();

    // Reset UI
    const msgEl = document.getElementById('chat-messages');
    if (msgEl) msgEl.innerHTML = '';
    updateRoundIndicator();
    updateSendButton(false);

    // Switch to chat screen
    switchScreen('chat');

    // Show greeting (not added to messages array — it's a client-side prompt)
    displayBubble('assistant',
      "Tell me about your project. What are you building or working on?\n\n" +
      "You can use **+ Attach files** to include .txt, .md, .json, specs, or other **text-based** documents with your message — they are sent to Claude as part of your turn (PDF/Word are not supported in the browser yet).\n\n" +
      "If you want a **multi-agent hub** (a `master/` coordinator plus separate `agents/<slug>/` workspaces), say so or describe distinct specialist areas — the AI will try to infer **stages** and **agent routing** from your brief.\n\n" +
      "A quick description plus any relevant files is enough to get started. I'll ask follow-up questions if needed, then pre-fill the wizard for you."
    );

    // Focus the input
    setTimeout(() => document.getElementById('chat-input')?.focus(), 80);
  }

  // ── PUBLIC: back ──────────────────────────────────────────────────────────

  function back() {
    switchScreen('home');
  }

  // ── PUBLIC: send ──────────────────────────────────────────────────────────

  async function send(text) {
    text = (text || '').trim();
    if ((!text && pendingAttachments.length === 0) || isSending) return;

    const payload = buildUserPayload(text);
    if (payload == null) return;

    const bubblePreview = buildUserBubblePreview(text);
    const pendingSnapshot = pendingAttachments.map(a => ({ name: a.name, text: a.text }));

    isSending = true;

    // Add user turn to conversation (full payload for the model)
    messages.push({ role: 'user', content: payload });
    displayBubble('user', bubblePreview);

    pendingAttachments = [];
    renderAttachmentChips();

    const input = document.getElementById('chat-input');
    if (input) input.value = '';

    updateSendButton(true);
    const typingId = showTypingIndicator();

    try {
      const res = await fetch(`${BACKEND_URL}/api/from-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, round: currentRound })
      });

      removeTypingIndicator(typingId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      currentRound = data.round;
      updateRoundIndicator();

      if (data.needs_more) {
        // Claude needs more info — show follow-up and keep chat open
        messages.push({ role: 'assistant', content: data.follow_up });
        displayBubble('assistant', data.follow_up);
        updateSendButton(false);
        setTimeout(() => document.getElementById('chat-input')?.focus(), 80);
      } else {
        // Got answers — show summary and hand off to the wizard
        const handoffMsg = (data.summary ? data.summary + '\n\n' : '') +
          "Opening the wizard with everything pre-filled. Review each field and click \u201cGenerate Workspace\u201d when you\u2019re ready.";
        displayBubble('assistant', handoffMsg);

        // Brief delay so the user can read the message before the screen changes
        setTimeout(() => applyAnswers(data.answers), 1500);
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      displayBubble('assistant',
        `Something went wrong: ${err.message}\n\n` +
        `You can try again, or use the manual wizard instead (go back and click "Build a new workspace").`
      );
      // Pop the failed user message so the user can retry
      messages.pop();
      pendingAttachments = pendingSnapshot;
      renderAttachmentChips();
      updateSendButton(false);
    } finally {
      isSending = false;
    }
  }

  // ── PUBLIC: applyAnswers ───────────────────────────────────────────────────

  function applyAnswers(answers) {
    if (window.ICM.app && window.ICM.app.enterWizardWithAnswers) {
      window.ICM.app.enterWizardWithAnswers(answers);
    }
  }

  // ── PUBLIC: init ───────────────────────────────────────────────────────────

  function init() {
    const sendBtn = document.getElementById('chat-send-btn');
    const input = document.getElementById('chat-input');
    const backBtn = document.getElementById('chat-back-btn');

    if (backBtn) {
      backBtn.addEventListener('click', back);
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const val = input?.value?.trim() || '';
        if (val || pendingAttachments.length) send(val);
      });
    }

    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const val = input.value.trim();
          if (val || pendingAttachments.length) send(val);
        }
      });
    }

    wireAttachmentUi();
  }

  // ── INTERNAL HELPERS ───────────────────────────────────────────────────────

  function switchScreen(name) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  }

  function displayBubble(role, text) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const block = document.createElement('div');
    block.className =
      role === 'user' ? 'chat-msg-block chat-msg-block-user' : 'chat-msg-block chat-msg-block-assistant';

    const labelRow = document.createElement('div');
    const line = document.createElement('span');
    line.className = 'chat-msg-label-line';
    line.setAttribute('aria-hidden', 'true');

    if (role === 'user') {
      labelRow.className = 'chat-msg-label chat-msg-label-user';
      labelRow.textContent = '[USER.INPUT]';
    } else {
      assistantBubbleCount += 1;
      const isFirst = assistantBubbleCount === 1;
      labelRow.className =
        'chat-msg-label ' +
        (isFirst ? 'chat-msg-label-assistant-primary' : 'chat-msg-label-assistant-tertiary');
      labelRow.appendChild(document.createTextNode(isFirst ? '[SYSTEM.PROMPT]' : '[SYSTEM.RESPONSE]'));
      labelRow.appendChild(line);
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble chat-bubble-${role}`;
    bubble.textContent = text;

    block.appendChild(labelRow);
    block.appendChild(bubble);
    container.appendChild(block);
    container.scrollTop = container.scrollHeight;
  }

  function showTypingIndicator() {
    const container = document.getElementById('chat-messages');
    if (!container) return null;
    const id = 'chat-typing-' + Date.now();
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg-block chat-msg-block-assistant';
    const labelRow = document.createElement('div');
    labelRow.className = 'chat-msg-label chat-msg-label-assistant-tertiary';
    const line = document.createElement('span');
    line.className = 'chat-msg-label-line';
    line.setAttribute('aria-hidden', 'true');
    labelRow.appendChild(document.createTextNode('[SYSTEM]'));
    labelRow.appendChild(line);
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-bubble chat-bubble-assistant chat-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(labelRow);
    wrap.appendChild(div);
    container.appendChild(wrap);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    if (id) document.getElementById(id)?.remove();
  }

  function updateRoundIndicator() {
    const el = document.getElementById('chat-round-indicator');
    if (!el) return;
    if (currentRound === 0) {
      el.textContent = '';
    } else {
      const remaining = MAX_ROUNDS - currentRound;
      el.textContent = remaining > 0
        ? `Follow-up ${currentRound} of ${MAX_ROUNDS}`
        : 'Generating your workspace spec…';
    }
  }

  function updateSendButton(isLoading) {
    const btn = document.getElementById('chat-send-btn');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? 'Thinking…' : 'Send →';
  }

  // Public API
  return { show, back, send, applyAnswers, init };
})();

document.addEventListener('DOMContentLoaded', () => window.ICM.chat.init());
