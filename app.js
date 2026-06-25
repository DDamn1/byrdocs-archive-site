(function () {
  const archive = window.BYR_DOCS_ARCHIVE || { items: [], counts: {}, total: 0 };
  const items = archive.items.map((item, index) => ({ ...item, index }));

  const state = {
    query: "",
    type: "all",
    course: "",
    year: "",
    sort: "relevance",
    tag: "",
    visible: 40,
    selectedId: null
  };

  const typeLabels = {
    all: "全部资料",
    test: "试题",
    doc: "资料",
    book: "书籍"
  };

  const els = {
    search: document.getElementById("searchInput"),
    reset: document.getElementById("resetButton"),
    typeSegment: document.getElementById("typeSegment"),
    course: document.getElementById("courseFilter"),
    year: document.getElementById("yearFilter"),
    sort: document.getElementById("sortSelect"),
    contentChips: document.getElementById("contentChips"),
    collegeChips: document.getElementById("collegeChips"),
    resultList: document.getElementById("resultList"),
    resultCount: document.getElementById("resultCount"),
    activeFilterText: document.getElementById("activeFilterText"),
    showMore: document.getElementById("showMoreButton"),
    detail: document.getElementById("detailView"),
    totalCount: document.getElementById("totalCount"),
    testCount: document.getElementById("testCount"),
    docCount: document.getElementById("docCount"),
    bookCount: document.getElementById("bookCount")
  };

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function countValues(values) {
    const counts = new Map();
    values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  }

  function fillSelect(select, values) {
    const existing = select.firstElementChild;
    select.textContent = "";
    select.appendChild(existing);
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function makeChipCloud(container, pairs) {
    container.textContent = "";
    pairs.slice(0, 18).forEach(([label, count]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tag = label;
      button.textContent = `${label} ${count}`;
      button.addEventListener("click", () => {
        state.tag = state.tag === label ? "" : label;
        state.visible = 40;
        render();
      });
      container.appendChild(button);
    });
  }

  function initFilters() {
    const courses = uniqueSorted(items.flatMap((item) => item.courseNames || []));
    const years = uniqueSorted(items.map((item) => item.year).filter(Boolean)).sort((a, b) => b.localeCompare(a));
    fillSelect(els.course, courses);
    fillSelect(els.year, years);
    makeChipCloud(els.contentChips, countValues(items.flatMap((item) => item.content || [])));
    makeChipCloud(els.collegeChips, countValues(items.flatMap((item) => item.colleges || [])));
  }

  function scoreItem(item, terms) {
    if (!terms.length) return 0;
    return terms.reduce((score, term) => {
      if (!item.search.includes(term)) return score - 1000;
      let next = score + 1;
      if (item.title.toLowerCase().includes(term)) next += 10;
      if ((item.courseNames || []).some((name) => name.toLowerCase().includes(term))) next += 6;
      if ((item.authors || []).some((name) => name.toLowerCase().includes(term))) next += 5;
      if ((item.isbn || []).some((isbn) => isbn.toLowerCase().includes(term))) next += 4;
      return next;
    }, 0);
  }

  function filteredItems() {
    const terms = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return items
      .map((item) => ({ ...item, score: scoreItem(item, terms) }))
      .filter((item) => {
        if (terms.length && item.score < 0) return false;
        if (state.type !== "all" && item.type !== state.type) return false;
        if (state.course && !(item.courseNames || []).includes(state.course)) return false;
        if (state.year && item.year !== state.year) return false;
        if (state.tag && ![...(item.content || []), ...(item.colleges || []), ...(item.tags || [])].includes(state.tag)) return false;
        return true;
      })
      .sort((a, b) => {
        if (state.sort === "year-desc") return (b.year || "").localeCompare(a.year || "") || a.title.localeCompare(b.title, "zh-CN");
        if (state.sort === "title") return a.title.localeCompare(b.title, "zh-CN");
        if (state.sort === "type") return a.type.localeCompare(b.type) || a.title.localeCompare(b.title, "zh-CN");
        return b.score - a.score || (b.year || "").localeCompare(a.year || "") || a.title.localeCompare(b.title, "zh-CN");
      });
  }

  function tagHtml(tags) {
    return (tags || []).slice(0, 5).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderResults(results) {
    const visible = results.slice(0, state.visible);
    els.resultList.textContent = "";

    if (!results.length) {
      els.resultList.innerHTML = '<div class="empty">没有匹配的条目。</div>';
      return;
    }

    visible.forEach((item) => {
      const card = document.createElement("article");
      card.className = `result-card${item.id === state.selectedId ? " active" : ""}`;
      card.tabIndex = 0;
      card.dataset.id = item.id;
      card.innerHTML = `
        <div class="card-head">
          <div>
            <h2 class="card-title">${escapeHtml(item.title)}</h2>
            <p class="card-subtitle">${escapeHtml(item.subtitle || item.id)}</p>
          </div>
          <span class="type-badge ${escapeHtml(item.type)}">${escapeHtml(item.typeLabel)}</span>
        </div>
        <div class="tag-row">${tagHtml(item.tags)}</div>
      `;
      card.addEventListener("click", () => selectItem(item.id));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectItem(item.id);
        }
      });
      els.resultList.appendChild(card);
    });
  }

  function field(label, value) {
    if (Array.isArray(value)) value = value.join(" / ");
    if (!value) return "";
    return `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function renderDetail(item) {
    if (!item) {
      els.detail.innerHTML = '<div class="empty">请选择一条结果。</div>';
      return;
    }

    els.detail.innerHTML = `
      <span class="detail-type">${escapeHtml(item.typeLabel)}</span>
      <h2 class="detail-title">${escapeHtml(item.title)}</h2>
      <p class="detail-subtitle">${escapeHtml(item.subtitle || item.id)}</p>
      <div class="tag-row">${tagHtml(item.tags)}</div>
      <dl class="field-grid">
        ${field("课程", item.courseNames)}
        ${field("年份", item.yearSpan || item.publishYear || item.year)}
        ${field("内容", item.content)}
        ${field("学院", item.colleges)}
        ${field("作者", item.authors)}
        ${field("译者", item.translators)}
        ${field("出版社", item.publisher)}
        ${field("版本", item.edition)}
        ${field("ISBN", item.isbn)}
        ${field("格式", item.filetype)}
        ${field("ID", item.id)}
      </dl>
      <a class="link-button" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开原始链接</a>
    `;
  }

  function describeFilters(results) {
    const labels = [typeLabels[state.type]];
    if (state.course) labels.push(state.course);
    if (state.year) labels.push(state.year);
    if (state.tag) labels.push(state.tag);
    if (state.query) labels.push(`"${state.query}"`);
    els.activeFilterText.textContent = labels.join(" · ");
    els.resultCount.textContent = `${results.length} 条结果`;
    els.showMore.hidden = results.length <= state.visible;
  }

  function syncControls() {
    [...els.typeSegment.querySelectorAll("button")].forEach((button) => {
      button.classList.toggle("active", button.dataset.type === state.type);
    });
    [...document.querySelectorAll(".chip-cloud button")].forEach((button) => {
      button.classList.toggle("active", button.dataset.tag === state.tag);
    });
    els.course.value = state.course;
    els.year.value = state.year;
    els.sort.value = state.sort;
  }

  function selectItem(id) {
    state.selectedId = id;
    const item = items.find((candidate) => candidate.id === id);
    renderDetail(item);
    [...els.resultList.querySelectorAll(".result-card")].forEach((card) => {
      card.classList.toggle("active", card.dataset.id === id);
    });
  }

  function render() {
    syncControls();
    const results = filteredItems();
    if (!results.some((item) => item.id === state.selectedId)) {
      state.selectedId = results[0] ? results[0].id : null;
    }
    describeFilters(results);
    renderResults(results);
    renderDetail(results.find((item) => item.id === state.selectedId));
  }

  function bindEvents() {
    els.search.addEventListener("input", () => {
      state.query = els.search.value;
      state.visible = 40;
      render();
    });
    els.reset.addEventListener("click", () => {
      state.query = "";
      state.type = "all";
      state.course = "";
      state.year = "";
      state.sort = "relevance";
      state.tag = "";
      state.visible = 40;
      els.search.value = "";
      render();
      els.search.focus();
    });
    els.typeSegment.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-type]");
      if (!button) return;
      state.type = button.dataset.type;
      state.visible = 40;
      render();
    });
    els.course.addEventListener("change", () => {
      state.course = els.course.value;
      state.visible = 40;
      render();
    });
    els.year.addEventListener("change", () => {
      state.year = els.year.value;
      state.visible = 40;
      render();
    });
    els.sort.addEventListener("change", () => {
      state.sort = els.sort.value;
      render();
    });
    els.showMore.addEventListener("click", () => {
      state.visible += 40;
      render();
    });
  }

  function setCounts() {
    els.totalCount.textContent = archive.total || items.length;
    els.testCount.textContent = archive.counts.test || 0;
    els.docCount.textContent = archive.counts.doc || 0;
    els.bookCount.textContent = archive.counts.book || 0;
  }

  setCounts();
  initFilters();
  bindEvents();
  render();
})();
