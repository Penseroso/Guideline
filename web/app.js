/**
 * web/app.js
 * M5 Phase 4, third pass (design-taste-frontend audit + direct user
 * critique). DOM wiring only: fetch, state, event handling, innerHTML
 * assignment. All HTML string construction lives in render.js (pure,
 * unit-tested with zero DOM); every string handed to it is escaped
 * there, not here.
 *
 * Idle vs. results state: the page starts centered and sparse
 * (`body.idle`), then collapses to a compact top search bar once the
 * first query resolves (`body.has-results`), mirroring Google's own
 * search-to-results transition. The archive-scope document list lives
 * behind a small "Scope" header button (a popover), not as permanent
 * on-screen chrome, per direct user feedback that it didn't need to
 * occupy the search screen.
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
    scopeToggle: document.getElementById("scope-toggle"),
    scopePopover: document.getElementById("scope-popover"),
    healthDot: document.getElementById("health-dot"),
    healthLabel: document.getElementById("health-label"),
    docList: document.getElementById("doc-list"),
    appTitle: document.getElementById("app-title"),
    idleWordmark: document.getElementById("idle-wordmark"),
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
    el.idleWordmark.textContent = t.title;
    el.askInput.placeholder = t.askPlaceholder;
    el.askButton.textContent = t.askButton;
    el.optionBToggle.textContent = state.optionBEnabled ? t.optionBToggleOn : t.optionBToggleOff;
    el.scopeToggle.textContent = state.documents.length ? `${t.archiveScopeTitle} (${state.documents.length})` : t.archiveScopeTitle;
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
      el.scopeToggle.textContent = `${i18n().archiveScopeTitle} (${state.documents.length})`;
    } catch {
      // Non-fatal, the popover just stays empty; the ask flow still works.
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

  /**
   * A single small "Feedback" control that expands into the 7-verdict
   * taxonomy on click, rather than rendering all 7 buttons by default.
   * Seven pre-rendered pill buttons under every answer was itself an
   * "AI dashboard" tell surfaced in review; a single quiet affordance
   * that expands on demand keeps the taxonomy (still a closed
   * vocabulary, never a rating, see engine/feedback_log.js) without
   * permanently occupying the page.
   */
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

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "feedback-trigger";
    trigger.textContent = t.feedbackPrompt;
    wrap.appendChild(trigger);

    trigger.addEventListener("click", () => {
      trigger.remove();

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
            wrap.innerHTML = "";
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
    });

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
      document.body.classList.remove("idle");
      document.body.classList.add("has-results");
      if (!res.ok) {
        el.resultPanel.innerHTML = `<div class="claim-error">${R.escapeHtml(envelope.error || "internal error")}</div>`;
        return;
      }
      el.resultPanel.innerHTML = R.renderEnvelope(envelope, i18n());
      el.resultPanel.appendChild(renderFeedbackBar(question, envelope));
    } catch (err) {
      document.body.classList.remove("idle");
      document.body.classList.add("has-results");
      el.resultPanel.innerHTML = `<div class="claim-error">${R.escapeHtml(String(err && err.message || err))}</div>`;
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

  el.scopeToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    el.scopePopover.hidden = !el.scopePopover.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!el.scopePopover.hidden && !el.scopePopover.contains(e.target) && e.target !== el.scopeToggle) {
      el.scopePopover.hidden = true;
    }
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
