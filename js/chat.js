// chat.js — Conversational entry point: describe your project, Claude pre-fills the wizard
// Public API via window.ICM.chat: show(), back(), send(), applyAnswers(), init()

window.ICM = window.ICM || {};

window.ICM.chat = (() => {

  const BACKEND_URL = (window.ICM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
  const MAX_ROUNDS = 3;

  // Messages sent to/from the API (not including the hardcoded greeting)
  // Always starts with a user message; alternates user/assistant.
  let messages = [];
  let currentRound = 0;
  let isSending = false;

  // ── PUBLIC: show ───────────────────────────────────────────────────────────

  function show() {
    messages = [];
    currentRound = 0;
    isSending = false;

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
      "A quick description of the workflow and what you want Claude to help you with is all you need to get started. " +
      "I'll ask a couple of follow-up questions if needed, then pre-fill the wizard for you."
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
    if (!text || isSending) return;

    isSending = true;

    // Add user turn to conversation
    messages.push({ role: 'user', content: text });
    displayBubble('user', text);

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
        const val = input?.value?.trim();
        if (val) send(val);
      });
    }

    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const val = input.value.trim();
          if (val) send(val);
        }
      });
    }
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
    const div = document.createElement('div');
    div.className = `chat-bubble chat-bubble-${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTypingIndicator() {
    const container = document.getElementById('chat-messages');
    if (!container) return null;
    const id = 'chat-typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-bubble chat-bubble-assistant chat-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
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
