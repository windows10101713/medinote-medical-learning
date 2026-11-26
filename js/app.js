(function () {
  "use strict";

  const STORAGE_KEY = "medlearn-v1";
  const PASS_PERCENT = 70;
  // 암기 상자 단계: 0이 가장 자주 복습되고, BOX_COUNT - 1 이면 암기 완료
  const BOX_COUNT = 5;

  const app = document.getElementById("app");

  const lessons = [];
  MED_DATA.subjects.forEach((subject) =>
    subject.lessons.forEach((lesson) => lessons.push({ ...lesson, subject }))
  );
  const termTotal = lessons.reduce((sum, l) => sum + l.terms.length, 0);
  const findLesson = (id) => lessons.find((l) => l.id === id);

  let state = loadState();

  function loadState() {
    const empty = { completed: {}, scores: {}, cards: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && typeof saved === "object" ? { ...empty, ...saved } : empty;
    } catch (e) {
      return empty;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // 저장소를 쓸 수 없는 환경에서는 현재 세션 동안만 유지됩니다.
    }
  }

  // 텍스트는 항상 textContent로 넣어 HTML 주입을 막습니다.
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "className") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "onclick") node.addEventListener("click", value);
        else if (key === "disabled") node.disabled = value;
        else node.setAttribute(key, value === true ? "" : value);
      }
    }
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function setView(...nodes) {
    app.replaceChildren(...nodes.flat(Infinity));
    window.scrollTo(0, 0);
  }

  function stat(num, label) {
    return el("div", { className: "stat" },
      el("div", { className: "num", text: num }),
      el("div", { className: "label", text: label }));
  }

  function lessonBadge(id) {
    if (state.completed[id]) {
      return el("span", { className: "badge done", text: `완료 · 최고 ${state.scores[id]}점` });
    }
    if (state.scores[id] !== undefined) {
      return el("span", { className: "badge", text: `최고 ${state.scores[id]}점` });
    }
    return el("span", { className: "badge", text: "미학습" });
  }

  function renderNotFound() {
    setView(
      el("p", { className: "empty", text: "페이지를 찾을 수 없습니다." }),
      el("div", { className: "btn-row" }, el("a", { className: "btn", href: "#/", text: "홈으로" }))
    );
  }

  // ---------- 홈 (과목 목록 + 검색) ----------

  function renderHome() {
    const input = el("input", {
      className: "search",
      type: "search",
      "aria-label": "강의와 용어 검색",
      placeholder: "강의 제목, 용어, 내용으로 검색 (예: 심장, GFR, 아스피린)",
    });
    const results = el("div");
    const filters = el("div", { className: "subject-filters", "aria-label": "과목 필터" });
    let activeSubject = "all";
    const firstUnfinished = lessons.find((lesson) => !state.completed[lesson.id]) || lessons[0];
    const filterButtons = [
      el("button", {
        className: "filter-chip active",
        type: "button",
        text: "전체 과목",
        onclick: () => selectSubject("all"),
      }),
      ...MED_DATA.subjects.map((subject) => el("button", {
        className: "filter-chip",
        type: "button",
        text: subject.name,
        onclick: () => selectSubject(subject.id),
      })),
    ];

    function selectSubject(id) {
      activeSubject = id;
      filterButtons.forEach((button, index) => {
        const selected = index === 0 ? id === "all" : MED_DATA.subjects[index - 1].id === id;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      draw();
    }

    const draw = () => {
      const q = input.value.trim().toLowerCase();
      filters.hidden = Boolean(q);
      results.replaceChildren(q
        ? searchResults(q)
        : subjectGrid(activeSubject === "all"
          ? MED_DATA.subjects
          : MED_DATA.subjects.filter((subject) => subject.id === activeSubject)));
    };
    input.addEventListener("input", draw);
    filterButtons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === 0));
      filters.append(button);
    });

    const completedCount = lessons.filter((lesson) => state.completed[lesson.id]).length;
    const hero = el("section", { className: "hero" },
      el("div", { className: "hero-copy" },
        el("span", { className: "eyebrow", text: "YOUR MEDICAL LEARNING SPACE" }),
        el("h1", null, "의학의 기초를 ", el("span", { className: "highlight", text: "차근차근" }), " 배워요"),
        el("p", { text: "핵심 개념을 익히고, 퀴즈와 반복 학습으로 내 지식으로 만들어 보세요." }),
        el("a", { className: "btn hero-btn", href: `#/lesson/${firstUnfinished.id}`, text: completedCount ? "이어서 학습하기 →" : "첫 강의 시작하기 →" })),
      el("div", { className: "hero-art", "aria-hidden": "true" },
        el("div", { className: "hero-orbit orbit-one" }),
        el("div", { className: "hero-orbit orbit-two" }),
        el("div", { className: "hero-cross", text: "+" }),
        el("div", { className: "hero-label label-top", text: "LEARN" }),
        el("div", { className: "hero-label label-bottom", text: "GROW" })));
    const summary = el("div", { className: "home-summary" },
      stat(`${MED_DATA.subjects.length}`, "학습 과목"),
      stat(`${lessons.length}`, "준비된 강의"),
      stat(`${completedCount} / ${lessons.length}`, "완료한 강의"));

    setView(
      hero,
      summary,
      el("div", { className: "section-heading" },
        el("div", null,
          el("span", { className: "eyebrow", text: "COURSE LIBRARY" }),
          el("h2", { text: "무엇을 공부할까요?" }),
          el("p", { className: "desc", text: `${lessons.length}개 강의 · ${termTotal}개 핵심 용어` })),
        el("a", { className: "text-link", href: "#/progress", text: "내 학습 현황 →" })),
      input,
      filters,
      results
    );
    draw();
  }

  function subjectGrid(subjects) {
    return el("div", { className: "grid" }, subjects.map((subject) =>
      el("section", { className: "card subject-card" },
        el("div", { className: "subject-heading" },
          el("span", { className: `subject-icon icon-${subject.id}`, "aria-hidden": "true", text: subject.name.slice(0, 1) }),
          el("div", null, el("h3", { text: subject.name }),
            el("div", { className: "meta", text: `${subject.lessons.length}개 강의` }))),
        el("p", { className: "subject-description", text: subject.description }),
        el("ul", { className: "lesson-list" }, subject.lessons.map((lesson) =>
          el("li", null,
            el("div", null,
              el("a", { className: "lesson-link", href: `#/lesson/${lesson.id}`, text: lesson.title }),
              lessonBadge(lesson.id)),
            el("a", { className: "quiz-link", href: `#/quiz/${lesson.id}`, "aria-label": `${lesson.title} 퀴즈 풀기`, text: "퀴즈 →" })
          )
        ))
      )
    ));
  }

  function searchResults(q) {
    const hits = [];
    lessons.forEach((lesson) => {
      const termHit = lesson.terms.find((t) => `${t.term} ${t.def}`.toLowerCase().includes(q));
      const textHit =
        lesson.title.toLowerCase().includes(q) ||
        lesson.subject.name.toLowerCase().includes(q) ||
        lesson.sections.some((s) => s.body.some((b) => b.toLowerCase().includes(q)));
      if (termHit || textHit) hits.push({ lesson, termHit });
    });
    if (hits.length === 0) {
      return el("p", { className: "empty", text: "검색 결과가 없습니다." });
    }
    return el("div", { className: "card" },
      el("ul", { className: "lesson-list" }, hits.map(({ lesson, termHit }) =>
        el("li", null,
          el("div", null,
            el("a", { href: `#/lesson/${lesson.id}`, text: `${lesson.subject.name} · ${lesson.title}` }),
            termHit ? el("div", { className: "meta", text: `용어: ${termHit.term} — ${termHit.def}` }) : null),
          lessonBadge(lesson.id)
        )
      ))
    );
  }

  // ---------- 강의 ----------

  function renderLesson(id) {
    const lesson = findLesson(id);
    if (!lesson) return renderNotFound();

    setView(
      el("div", { className: "breadcrumb" },
        el("a", { href: "#/", text: "홈" }), " › ", lesson.subject.name, " › ", lesson.title),
      el("h1", { text: lesson.title }),
      el("div", { className: "btn-row", style: "margin-bottom:16px" }, lessonBadge(lesson.id)),
      lesson.sections.map((section) =>
        el("section", { className: "card section-body" },
          el("h2", { text: section.heading }),
          section.body.map((line) => el("p", { text: line })))
      ),
      el("section", { className: "card" },
        el("h2", { text: "핵심 용어" }),
        el("dl", { className: "terms" }, lesson.terms.map((t) => [
          el("dt", { text: t.term }),
          el("dd", { text: t.def }),
        ]))
      ),
      el("div", { className: "btn-row" },
        el("a", { className: "btn", href: `#/quiz/${lesson.id}`, text: "퀴즈 풀기" }),
        el("a", { className: "btn accent", href: `#/cards/${lesson.id}`, text: "이 강의 용어 암기" }),
        el("a", { className: "btn secondary", href: "#/", text: "목록으로" })
      )
    );
  }

  // ---------- 퀴즈 ----------

  let quiz = null;

  function renderQuiz(id) {
    const lesson = findLesson(id);
    if (!lesson) return renderNotFound();
    quiz = { lesson, index: 0, correct: 0, wrong: [] };
    showQuestion();
  }

  function showQuestion() {
    const { lesson, index } = quiz;
    const total = lesson.quiz.length;
    const item = lesson.quiz[index];

    const feedback = el("div");
    const next = el("button", {
      className: "btn",
      text: index + 1 < total ? "다음 문제" : "결과 보기",
      disabled: true,
      onclick: () => {
        quiz.index++;
        if (quiz.index < total) showQuestion();
        else showResult();
      },
    });

    const choices = item.choices.map((text, i) => el("button", {
      className: "choice",
      text: `${i + 1}. ${text}`,
    }));

    choices.forEach((btn, i) => btn.addEventListener("click", () => {
      choices.forEach((b) => (b.disabled = true));
      const isRight = i === item.answer;
      if (isRight) {
        quiz.correct++;
        btn.classList.add("correct");
      } else {
        btn.classList.add("wrong");
        choices[item.answer].classList.add("correct");
        quiz.wrong.push({
          q: item.q,
          yours: item.choices[i],
          right: item.choices[item.answer],
          explain: item.explain,
        });
      }
      feedback.replaceChildren(
        el("div", { className: `feedback ${isRight ? "ok" : "bad"}` },
          el("strong", { text: isRight ? "정답입니다!" : "틀렸습니다." }),
          el("div", { className: "explain", text: item.explain }))
      );
      next.disabled = false;
    }));

    setView(
      el("div", { className: "breadcrumb" },
        el("a", { href: `#/lesson/${lesson.id}`, text: "← 강의로" }), ` · ${lesson.title} 퀴즈`),
      el("div", { className: "progress-bar" },
        el("div", { style: `width:${(index / total) * 100}%` })),
      el("section", { className: "card" },
        el("div", { className: "meta", text: `문제 ${index + 1} / ${total}` }),
        el("h2", { text: item.q }),
        choices,
        feedback,
        el("div", { className: "btn-row" }, next))
    );
  }

  function showResult() {
    const { lesson, correct, wrong } = quiz;
    const total = lesson.quiz.length;
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= PASS_PERCENT;

    if (state.scores[lesson.id] === undefined || pct > state.scores[lesson.id]) {
      state.scores[lesson.id] = pct;
    }
    if (passed) state.completed[lesson.id] = true;
    saveState();

    setView(
      el("h1", { text: `${lesson.title} 퀴즈 결과` }),
      el("section", { className: "card" },
        el("div", { className: "stats" },
          stat(`${correct} / ${total}`, "정답 수"),
          stat(`${pct}점`, "이번 점수"),
          stat(passed ? "통과" : "재도전", "판정")),
        el("p", {
          text: passed
            ? "강의를 완료했습니다. 잘하셨습니다!"
            : `${PASS_PERCENT}점 이상이면 강의가 완료 처리됩니다. 틀린 문제를 복습한 뒤 다시 도전해 보세요.`,
        })),
      wrong.length > 0
        ? el("section", { className: "card" },
            el("h2", { text: "틀린 문제 복습" }),
            wrong.map((w) => el("div", { className: "wrong-item" },
              el("strong", { text: w.q }),
              el("div", { className: "you", text: `내 답: ${w.yours}` }),
              el("div", { className: "right", text: `정답: ${w.right}` }),
              el("div", { text: w.explain }))))
        : el("p", { className: "empty", text: "모든 문제를 맞혔습니다!" }),
      el("div", { className: "btn-row" },
        el("button", { className: "btn", text: "다시 풀기", onclick: () => renderQuiz(lesson.id) }),
        el("a", { className: "btn secondary", href: `#/lesson/${lesson.id}`, text: "강의로" }),
        el("a", { className: "btn secondary", href: "#/", text: "홈" }))
    );
  }

  // ---------- 용어 암기 (상자 기반 간격 반복) ----------

  function boxOf(key) {
    return state.cards[key] || 0;
  }

  // 가장 낮은 단계의 카드 중에서 고르며, 방금 본 카드는 가능하면 피합니다.
  function pickCard(deck) {
    const minBox = Math.min(...deck.cards.map((c) => boxOf(c.key)));
    let pool = deck.cards.filter((c) => boxOf(c.key) === minBox);
    if (pool.length > 1) pool = pool.filter((c) => c !== deck.current);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function renderCards(lessonId) {
    let source = lessons;
    let title = "전체 용어 암기";
    if (lessonId) {
      const lesson = findLesson(lessonId);
      if (!lesson) return renderNotFound();
      source = [lesson];
      title = `${lesson.title} 용어 암기`;
    }

    const cards = [];
    source.forEach((lesson) =>
      lesson.terms.forEach((t, i) =>
        cards.push({ key: `${lesson.id}#${i}`, lesson, term: t.term, def: t.def })));

    const deck = { cards, current: null, flipped: false };
    const statsBox = el("div", { className: "stats", style: "margin-bottom:16px" });
    const face = el("button", { className: "card flashcard", type: "button" });
    const controls = el("div", { className: "btn-row", style: "justify-content:center" });

    const rate = (remembered) => {
      const key = deck.current.key;
      state.cards[key] = remembered ? Math.min(BOX_COUNT - 1, boxOf(key) + 1) : 0;
      saveState();
      deck.flipped = false;
      deck.current = pickCard(deck);
      paint();
    };

    const paint = () => {
      if (cards.length === 0) {
        setView(el("p", { className: "empty", text: "암기할 용어가 없습니다." }));
        return;
      }
      if (!deck.current) deck.current = pickCard(deck);
      const c = deck.current;
      const mastered = cards.filter((x) => boxOf(x.key) === BOX_COUNT - 1).length;
      const needReview = cards.filter((x) => boxOf(x.key) === 0).length;

      statsBox.replaceChildren(
        stat(`${mastered} / ${cards.length}`, "암기 완료"),
        stat(`${needReview}`, "복습 필요(0단계)"));

      face.replaceChildren(
        el("div", { className: "meta", text: `${c.lesson.subject.name} · ${c.lesson.title}` }),
        deck.flipped
          ? el("div", { className: "def", text: c.def })
          : el("div", { text: c.term }),
        el("div", { className: "hint", text: deck.flipped ? "" : "카드를 눌러 뜻을 확인하세요" }));
      face.setAttribute("aria-pressed", String(deck.flipped));
      face.setAttribute("aria-label", deck.flipped ? `${c.term}: ${c.def}` : `${c.term}, 뜻 보기`);
      face.onclick = () => {
        if (deck.flipped) return;
        deck.flipped = true;
        paint();
      };

      controls.replaceChildren(
        el("button", { className: "btn danger", text: "모르겠어요", disabled: !deck.flipped, onclick: () => rate(false) }),
        el("button", { className: "btn accent", text: "알아요", disabled: !deck.flipped, onclick: () => rate(true) }));
    };

    setView(
      el("h1", { text: title }),
      el("p", { className: "desc", text: "‘모르겠어요’를 고르면 더 자주 나오고, ‘알아요’를 고를수록 간격이 길어지며 암기 완료 단계로 올라갑니다." }),
      statsBox,
      face,
      controls);
    paint();
  }

  // ---------- 진도 ----------

  function renderProgress() {
    const done = lessons.filter((l) => state.completed[l.id]).length;
    const scored = lessons.filter((l) => state.scores[l.id] !== undefined);
    const avg = scored.length
      ? Math.round(scored.reduce((sum, l) => sum + state.scores[l.id], 0) / scored.length)
      : null;
    const mastered = Object.values(state.cards).filter((b) => b === BOX_COUNT - 1).length;

    setView(
      el("h1", { text: "내 진도" }),
      el("section", { className: "card" },
        el("div", { className: "stats" },
          stat(`${done} / ${lessons.length}`, "완료한 강의"),
          stat(avg === null ? "-" : `${avg}점`, "퀴즈 최고점 평균"),
          stat(`${mastered} / ${termTotal}`, "암기 완료 용어"))),
      el("section", { className: "card" },
        el("h2", { text: "과목별 진도" }),
        MED_DATA.subjects.map((s) => {
          const d = s.lessons.filter((l) => state.completed[l.id]).length;
          const pct = Math.round((d / s.lessons.length) * 100);
          return el("div", { style: "margin-bottom:12px" },
            el("div", { text: `${s.name}  ${d} / ${s.lessons.length}` }),
            el("div", { className: "progress-bar" }, el("div", { style: `width:${pct}%` })));
        })),
      el("div", { className: "btn-row" },
        el("button", { className: "btn danger", text: "진도 초기화", onclick: resetProgress })));
  }

  function resetProgress() {
    if (!confirm("모든 진도와 암기 기록을 삭제할까요?")) return;
    state = { completed: {}, scores: {}, cards: {} };
    saveState();
    renderProgress();
  }

  // ---------- 라우팅 ----------

  function route() {
    const [page, arg] = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (!page) renderHome();
    else if (page === "lesson") renderLesson(arg);
    else if (page === "quiz") renderQuiz(arg);
    else if (page === "cards") renderCards(arg || null);
    else if (page === "progress") renderProgress();
    else renderNotFound();
  }

  window.addEventListener("hashchange", route);
  route();
})();
