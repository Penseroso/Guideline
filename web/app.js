/**
 * web/app.js
 * M5 Phase 4: DOM wiring only — fetch, state, event handling, innerHTML
 * assignment. All HTML string construction lives in render.js (pure,
 * unit-tested with zero DOM). This file owns escaping discipline at the
 * boundary: every string handed to render.js's functions is escaped
 * there, not here — this file must never build HTML by concatenation
 * itself.
 */
(function () {
  "use strict";

  const R = window.GuidelineRender;
  const I18N = window.GuidelineI18n;

  const state = {
    lang: localStorage.getItem("guideline_lang") || "ko",
    optionBEnabled: true,
    documents: []
  };

  function i18n() {
    return I18N[state.lang] || I18N.ko;
  }

  const el = {
    langToggle: document.getElementById("lang-toggle"),
    optionBToggle: document.getElementById("optionb-toggle"),
    healthDot: document.getElementById("health-dot"),
    healthLabel: document.getElementById("health-label"),
    docList: document.getElementById("doc-list"),
    sidebarTitle: document.getElementById("sidebar-title"),
    sidebarNote: document.getElementById("sidebar-note"),
    appTitle: document.getElementById("app-title"),
    askForm: document.getElementById("ask-form"),
    askInput: document.getElementById("ask-input"),
    askButton: document.getElementById("ask-button"),
    loadingPhase: document.getElementById("loading-phase"),
    resultPanel: document.getElementById("result-panel")
  };

  function applyChrome() {
    const t = i18n();
    document.title = t.title;
    el.appTitle.textContent = t.title;
    el.askInput.placeholder = t.askPlaceholder;
    el.askButton.textContent = t.askButton;
    el.sidebarTitle.textContent = t.archiveScopeTitle;
    el.sidebarNote.textContent = t.archiveScopeNote;
    el.optionBToggle.textContent = state.optionBEnabled ? t.optionBToggleOn : t.optionBToggleOff;
    renderDocList();
  }

  function renderDocList() {
    el.docList.innerHTML = state.documents
      .map((d) => `<li class="doc-item"><span>${R.escapeHtml(d.title)}</span><span class="doc-count">${d.record_count}</span></li>`)
      .join("");
  }

  async function loadHealth() {
    try {
      const res = await fetch("/api/health");
      const body = await res.json();
      el.healthDot.className = "health-dot ok";
      el.healthLabel.textContent = `${i18n().healthOk} · ${body.documents} docs · ${body.records} records${body.option_b_available ? "" : " · Option B unavailable"}`;
      if (!body.option_b_available) state.optionBEnabled = false;
    } catch {
      el.healthDot.className = "health-dot error";
      el.healthLabel.textContent = i18n().healthError;
    }
  }

  async function loadDocuments() {
    try {
      const res = await fetch("/api/documents");
      const body = await res.json();
      state.documents = body.documents || [];
      renderDocList();
    } catch {
      // Non-fatal — the sidebar just stays empty; the ask flow still works.
    }
  }

  const LOADING_PHASES_OPTION_B = ["askButtonLoadingSearch", "askButtonLoadingGenerate", "askButtonLoadingVerify"];

  function startLoadingPhases(optionB) {
    el.askButton.disabled = true;
    if (!optionB) {
      el.loadingPhase.textContent = i18n()[LOADING_PHASES_OPTION_B[0]];
      return () => { el.loadingPhase.textContent = ""; el.askButton.disabled = false; };
    }
    let idx = 0;
    el.loadingPhase.textContent = i18n()[LOADING_PHASES_OPTION_B[0]];
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, LOADING_PHASES_OPTION_B.length - 1);
      el.loadingPhase.textContent = i18n()[LOADING_PHASES_OPTION_B[idx]];
    }, 1800);
    return () => {
      clearInterval(timer);
      el.loadingPhase.textContent = "";
      el.askButton.disabled = false;
    };
  }

  function renderFeedbackBar(question, envelope) {
    const t = i18n();
    const verdicts = [
      ["wrong_citation", t.feedbackWrongCitation],
      ["unsupported_claim", t.feedbackUnsupportedClaim],
      ["wrongly_refused", t.feedbackWronglyRefused],
      ["should_have_refused", t.feedbackShouldHaveRefused],
      ["modality_wrong", t.feedbackModalityWrong],
      ["incomplete", t.feedbackIncomplete],
      ["correct", t.feedbackCorrect]
    ];
    const wrap = document.createElement("div");
    wrap.className = "feedback-bar";
    const prompt = document.createElement("span");
    prompt.className = "feedback-prompt";
    prompt.textContent = t.feedbackPrompt + ":";
    wrap.appendChild(prompt);

    const noteInput = document.createElement("input");
    noteInput.type = "text";
    noteInput.className = "feedback-note-input";
    noteInput.placeholder = t.feedbackNotePlaceholder;

    for (const [verdict, label] of verdicts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "feedback-btn";
      btn.textContent = label;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              interaction_id: envelope.interaction_id || null,
              question,
              verdict,
              note: noteInput.value || null,
              path: envelope.path,
              mode: envelope.mode,
              answered: envelope.answered,
              cited_source_unit_ids: (envelope.claims || []).map((c) => c.source_unit_id).filter(Boolean),
              answer_text: envelope.prose
            })
          });
          const sent = document.createElement("span");
          sent.className = "feedback-sent";
          sent.textContent = t.feedbackSent;
          wrap.appendChild(sent);
        } catch {
          btn.disabled = false;
        }
      });
      wrap.appendChild(btn);
    }
    wrap.appendChild(noteInput);
    return wrap;
  }

  async function ask(question, { forceOptionB } = {}) {
    const optionB = forceOptionB || state.optionBEnabled;
    const stopLoading = startLoadingPhases(optionB);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, allow_option_b: optionB })
      });
      const envelope = await res.json();
      if (!res.ok) {
        el.resultPanel.innerHTML = `<div class="claim-card-error">${R.escapeHtml(envelope.error || "internal error")}</div>`;
        return;
      }
      el.resultPanel.innerHTML = R.renderEnvelope(envelope, i18n());
      el.resultPanel.appendChild(renderFeedbackBar(question, envelope));
    } catch (err) {
      el.resultPanel.innerHTML = `<div class="claim-card-error">${R.escapeHtml(String(err && err.message || err))}</div>`;
    } finally {
      stopLoading();
    }
  }

  el.langToggle.addEventListener("click", () => {
    state.lang = state.lang === "ko" ? "en" : "ko";
    localStorage.setItem("guideline_lang", state.lang);
    applyChrome();
  });

  el.optionBToggle.addEventListener("click", () => {
    state.optionBEnabled = !state.optionBEnabled;
    el.optionBToggle.textContent = state.optionBEnabled ? i18n().optionBToggleOn : i18n().optionBToggleOff;
  });

  el.askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = el.askInput.value.trim();
    if (!q) return;
    ask(q);
  });

  // Ctrl+Enter forces Option B regardless of the toggle state.
  el.askInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const q = el.askInput.value.trim();
      if (q) ask(q, { forceOptionB: true });
    }
  });

  applyChrome();
  loadHealth();
  loadDocuments();
})();
