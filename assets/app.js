(() => {
  "use strict";

  const dataset = window.POKECA || { meta: { total_count: 0 }, cards: [] };
  const variantsByNo = window.POKECA_VARIANTS || {};
  const psaByNo = window.POKECA_PSA || {};
  const cards = [...dataset.cards].sort((a, b) => Number(a.no) - Number(b.no));
  const totalCount = Number(dataset.meta?.total_count || cards.length);
  const packageInfo = dataset.meta?.package || null;

  const typeDefinitions = [
    { key: "ほのお", label: "炎", fullLabel: "炎(ほのお)", color: "#E8533B" },
    { key: "みず", label: "水", fullLabel: "水(みず)", color: "#3E8EDE" },
    { key: "くさ", label: "草", fullLabel: "草(くさ)", color: "#5BB04A" },
    { key: "でんき", label: "雷", fullLabel: "雷(でんき)", color: "#F2C200" },
    { key: "エスパー", label: "超", fullLabel: "超(エスパー)", color: "#A05BC0" },
    { key: "かくとう", label: "闘", fullLabel: "闘(かくとう)", color: "#C77B3A" },
    { key: "あく", label: "悪", fullLabel: "悪(あく)", color: "#3A332A" },
    { key: "はがね", label: "鋼", fullLabel: "鋼(はがね)", color: "#8A97A6" },
    { key: "無色", label: "無色", fullLabel: "無色(ノーマル)", color: "#C8BFA6" },
    { key: "ドラゴン", label: "竜", fullLabel: "ドラゴン", color: "#6A52C7" },
    { key: "トレーナー", label: "トレーナー", fullLabel: "トレーナー", color: "#D98C2B" },
    { key: "エネルギー", label: "エネルギー", fullLabel: "エネルギー", color: "#6B5D45" },
  ];

  const typeByKey = new Map(typeDefinitions.map((type) => [type.key, type]));
  const rarityDefinitions = [
    { key: "●", label: "●", name: "コモン", className: "rarity--common" },
    { key: "◆", label: "◆", name: "アンコモン", className: "rarity--uncommon" },
    { key: "★", label: "★", name: "レア", className: "rarity--rare" },
    { key: "☆", label: "☆", name: "レアホロ", className: "rarity--rare" },
  ];
  const rarityByKey = new Map(rarityDefinitions.map((rarity) => [rarity.key, rarity]));

  const state = {
    selectedTypes: new Set(),
    selectedRarities: new Set(),
    query: "",
    visibleCards: [...cards],
    activeCardNo: null,
    activeVariantIndex: 0,
    lastFocusedTile: null,
  };

  const els = {
    grid: document.getElementById("card-grid"),
    resultCount: document.getElementById("result-count"),
    emptyState: document.getElementById("empty-state"),
    searchInput: document.getElementById("search-input"),
    resetButton: document.getElementById("reset-button"),
    typeFilters: document.getElementById("type-filters"),
    rarityFilters: document.getElementById("rarity-filters"),
    modal: document.getElementById("card-modal"),
    modalPanel: document.querySelector(".modal-panel"),
    modalHeader: document.querySelector(".modal-header"),
    modalClose: document.getElementById("modal-close"),
    modalNo: document.getElementById("modal-no"),
    modalTitle: document.getElementById("modal-title"),
    modalThumb: document.getElementById("modal-thumb"),
    modalImage: document.getElementById("modal-image"),
    modalFallback: document.getElementById("modal-fallback"),
    modalChips: document.getElementById("modal-chips"),
    modalVariantCaption: null,
    modalVariants: null,
    modalVariantsTitle: null,
    modalVariantStrip: null,
    modalDetails: document.getElementById("modal-details"),
    marketLinks: document.getElementById("market-links"),
    psaSection: document.getElementById("psa-section"),
    psaBody: document.getElementById("psa-body"),
    prevCard: document.getElementById("prev-card"),
    nextCard: document.getElementById("next-card"),
    sourceLink: document.getElementById("source-link"),
    packageOpen: document.getElementById("package-open"),
    packageModal: document.getElementById("package-modal"),
    packagePanel: document.querySelector(".package-panel"),
    packageHeader: document.querySelector(".package-header"),
    packageClose: document.getElementById("package-close"),
    packageTitle: document.getElementById("package-title"),
    packageImageFrame: document.getElementById("package-image-frame"),
    packageImage: document.getElementById("package-image"),
    packageRelease: document.getElementById("package-release"),
    packagePrice: document.getElementById("package-price"),
    packagePerPack: document.getElementById("package-per-pack"),
    packageTotal: document.getElementById("package-total"),
    packageRarity: document.getElementById("package-rarity"),
    packageCover: document.getElementById("package-cover"),
  };

  const tileByNo = new Map();

  function padNo(no) {
    return String(no).padStart(3, "0");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
      .replace(/\s+/g, "");
  }

  function normalizeRarity(rarity) {
    const symbol = String(rarity || "").trim().charAt(0);
    return rarityByKey.has(symbol) ? symbol : symbol || "-";
  }

  function getTypeKey(card) {
    if (card.card_type === "トレーナー") {
      return "トレーナー";
    }
    if (card.card_type === "エネルギー") {
      return "エネルギー";
    }
    return card.pokemon_type || card.card_type || "無色";
  }

  function getTypeInfo(cardOrKey) {
    const key = typeof cardOrKey === "string" ? cardOrKey : getTypeKey(cardOrKey);
    return typeByKey.get(key) || {
      key,
      label: key || "-",
      fullLabel: key || "-",
      color: "#D8C7A8",
    };
  }

  function getRarityInfo(cardOrRarity) {
    const key = typeof cardOrRarity === "string" ? normalizeRarity(cardOrRarity) : normalizeRarity(cardOrRarity.rarity);
    return rarityByKey.get(key) || {
      key,
      label: key,
      name: String(cardOrRarity.rarity || cardOrRarity || "-"),
      className: "rarity--common",
    };
  }

  function getStageLabel(card) {
    if (card.stage && card.stage !== "-") {
      return card.stage;
    }
    return card.card_type || "-";
  }

  function getHpLabel(card) {
    return Number.isFinite(Number(card.hp)) ? `HP${card.hp}` : "HP -";
  }

  function formatDate(dateText) {
    const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return dateText || "-";
    }
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("ja-JP") : "0";
  }

  function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) : "0.0";
  }

  function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    if (options.className) {
      element.className = options.className;
    }
    if (options.text !== undefined) {
      element.textContent = options.text;
    }
    if (options.html !== undefined) {
      element.innerHTML = options.html;
    }
    if (options.attrs) {
      for (const [key, value] of Object.entries(options.attrs)) {
        element.setAttribute(key, value);
      }
    }
    return element;
  }

  function setTypeStyle(element, cardOrKey) {
    element.style.setProperty("--type-color", getTypeInfo(cardOrKey).color);
  }

  function markImageFallback(thumb, fallbackText) {
    thumb.classList.add("img-fallback");
    thumb.dataset.fallback = fallbackText;
    const fallback = thumb.querySelector(".fallback-text");
    if (fallback) {
      fallback.textContent = fallbackText;
    }
  }

  function clearImageFallback(thumb) {
    thumb.classList.remove("img-fallback");
    delete thumb.dataset.fallback;
  }

  function setupVariantElements() {
    const caption = createElement("p", {
      className: "variant-caption",
      attrs: { id: "modal-variant-caption" },
    });
    const section = createElement("section", {
      className: "variant-section",
      attrs: { "aria-labelledby": "modal-variant-title" },
    });
    const title = createElement("h3", {
      className: "variant-title",
      attrs: { id: "modal-variant-title" },
    });
    const strip = createElement("div", {
      className: "variant-strip",
      attrs: { role: "list" },
    });

    section.append(title, strip);
    els.modalThumb.insertAdjacentElement("afterend", caption);
    els.modalChips.insertAdjacentElement("afterend", section);

    els.modalVariantCaption = caption;
    els.modalVariants = section;
    els.modalVariantsTitle = title;
    els.modalVariantStrip = strip;
  }

  function buildFilterButton({ key, label, fullLabel, color }, group) {
    const button = createElement("button", {
      className: "filter-chip",
      attrs: {
        type: "button",
        "aria-pressed": "false",
        "data-filter-key": key,
      },
    });
    button.style.setProperty("--type-color", color);
    button.append(
      createElement("span", { className: "chip-dot", attrs: { "aria-hidden": "true" } }),
      document.createTextNode(label)
    );
    button.setAttribute("aria-label", `${fullLabel}で絞り込み`);
    button.addEventListener("click", () => toggleFilter(group, key));
    return button;
  }

  function buildRarityButton(rarity) {
    const button = createElement("button", {
      className: "filter-chip",
      attrs: {
        type: "button",
        "aria-pressed": "false",
        "data-filter-key": rarity.key,
        "aria-label": `${rarity.name}で絞り込み`,
      },
    });
    button.append(
      createElement("span", { className: `rarity ${rarity.className}`, text: rarity.label, attrs: { "aria-hidden": "true" } }),
      document.createTextNode(rarity.name)
    );
    return button;
  }

  function renderFilters() {
    const presentTypes = new Set(cards.map((card) => getTypeKey(card)));
    for (const type of typeDefinitions.filter((item) => presentTypes.has(item.key))) {
      els.typeFilters.append(buildFilterButton(type, "type"));
    }

    const presentRarities = new Set(cards.map((card) => normalizeRarity(card.rarity)));
    for (const rarity of rarityDefinitions.filter((item) => presentRarities.has(item.key) && item.key !== "☆")) {
      const button = buildRarityButton(rarity);
      button.addEventListener("click", () => toggleFilter("rarity", rarity.key));
      els.rarityFilters.append(button);
    }
  }

  function buildTile(card) {
    const typeInfo = getTypeInfo(card);
    const rarityInfo = getRarityInfo(card);
    const no = padNo(card.no);
    const tile = createElement("button", {
      className: "card-tile",
      attrs: {
        type: "button",
        "data-no": String(card.no),
        "data-type": typeInfo.key,
        "data-rarity": rarityInfo.key,
        "aria-label": `No.${no} ${card.name_ja} の詳細を開く`,
      },
    });
    setTypeStyle(tile, card);

    const thumb = createElement("span", { className: "thumb" });
    const img = createElement("img", {
      attrs: {
        src: card.image_url,
        alt: `${card.name_ja}のカード画像`,
        loading: "lazy",
        decoding: "async",
        width: "500",
        height: "698",
      },
    });
    img.addEventListener("error", () => markImageFallback(thumb, `No.${no}\n${card.name_ja}\n画像なし`), { once: true });
    thumb.append(
      img,
      createElement("span", { className: "fallback-ball", attrs: { "aria-hidden": "true" } }),
      createElement("span", { className: "fallback-text" }),
      createElement("span", { className: "no-badge", text: `No.${no}` }),
      createElement("span", {
        className: `rarity ${rarityInfo.className}`,
        text: rarityInfo.key,
        attrs: { "aria-label": `レアリティ ${rarityInfo.name}` },
      }),
      createElement("span", {
        className: `stage${card.stage === "1進化" || card.stage === "2進化" ? " stage--evolved" : ""}`,
        text: getStageLabel(card),
      })
    );

    tile.append(
      thumb,
      createElement("span", { className: "type-bar", attrs: { "aria-hidden": "true" } }),
      createElement("span", {
        className: "tile-info",
        html: `<span class="tile-name"></span><span class="type-dot" aria-label="${typeInfo.fullLabel}"></span><span class="tile-hp"></span>`,
      })
    );
    tile.querySelector(".tile-name").textContent = card.name_ja;
    tile.querySelector(".tile-hp").textContent = getHpLabel(card);
    tile.addEventListener("click", () => openModal(card.no, { updateHash: true, push: true, focusSource: tile }));
    tileByNo.set(Number(card.no), tile);
    return tile;
  }

  function renderCards() {
    const fragment = document.createDocumentFragment();
    for (const card of cards) {
      fragment.append(buildTile(card));
    }
    els.grid.append(fragment);
  }

  function toggleFilter(group, key) {
    const set = group === "type" ? state.selectedTypes : state.selectedRarities;
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    applyFilters({ updateUrl: true });
  }

  function cardMatchesQuery(card, normalizedQuery) {
    if (!normalizedQuery) {
      return true;
    }
    const no = String(card.no);
    const padded = padNo(card.no);
    if (/^\d+$/.test(normalizedQuery) && (no.includes(normalizedQuery) || padded.includes(normalizedQuery))) {
      return true;
    }
    const haystack = normalizeText(`${card.name_ja} ${card.name_en} ${padded} ${no}`);
    return haystack.includes(normalizedQuery);
  }

  function updateFilterButtons() {
    for (const button of document.querySelectorAll("[data-filter-key]")) {
      const key = button.getAttribute("data-filter-key");
      const parent = button.closest("#type-filters") ? state.selectedTypes : state.selectedRarities;
      button.setAttribute("aria-pressed", String(parent.has(key)));
    }
  }

  function applyFilters({ updateUrl = false } = {}) {
    const normalizedQuery = normalizeText(state.query);
    state.visibleCards = [];

    for (const card of cards) {
      const tile = tileByNo.get(Number(card.no));
      const typeKey = getTypeKey(card);
      const rarityKey = normalizeRarity(card.rarity);
      const typeOk = state.selectedTypes.size === 0 || state.selectedTypes.has(typeKey);
      const rarityOk = state.selectedRarities.size === 0 || state.selectedRarities.has(rarityKey);
      const queryOk = cardMatchesQuery(card, normalizedQuery);
      const visible = typeOk && rarityOk && queryOk;
      tile.hidden = !visible;
      if (visible) {
        state.visibleCards.push(card);
      }
    }

    updateFilterButtons();
    els.resultCount.textContent = `表示中 ${state.visibleCards.length} / 全 ${totalCount} 枚`;
    els.emptyState.hidden = state.visibleCards.length !== 0;

    if (updateUrl) {
      writeFiltersToUrl();
    }
  }

  function readFiltersFromUrl() {
    const params = new URLSearchParams(location.search);
    const types = (params.get("type") || "").split(",").filter(Boolean);
    const rarities = (params.get("rarity") || "").split(",").filter(Boolean);
    for (const type of types) {
      if (typeByKey.has(type)) {
        state.selectedTypes.add(type);
      }
    }
    for (const rarity of rarities) {
      if (rarityByKey.has(rarity)) {
        state.selectedRarities.add(rarity);
      }
    }
    state.query = params.get("q") || "";
    els.searchInput.value = state.query;
  }

  function writeFiltersToUrl() {
    const url = new URL(location.href);
    const params = url.searchParams;
    const typeValue = [...state.selectedTypes].join(",");
    const rarityValue = [...state.selectedRarities].join(",");

    if (typeValue) {
      params.set("type", typeValue);
    } else {
      params.delete("type");
    }
    if (rarityValue) {
      params.set("rarity", rarityValue);
    } else {
      params.delete("rarity");
    }
    if (state.query) {
      params.set("q", state.query);
    } else {
      params.delete("q");
    }
    history.replaceState(history.state, "", url);
  }

  function resetFilters() {
    state.selectedTypes.clear();
    state.selectedRarities.clear();
    state.query = "";
    els.searchInput.value = "";
    applyFilters({ updateUrl: true });
  }

  function debounce(callback, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
  }

  function getCard(no) {
    return cards.find((card) => Number(card.no) === Number(no)) || null;
  }

  function getCardIndex(no) {
    return cards.findIndex((card) => Number(card.no) === Number(no));
  }

  function createSummaryChip(text, typeInfo, rarityInfo) {
    const chip = createElement("span", { className: "summary-chip" });
    if (typeInfo) {
      chip.style.setProperty("--type-color", typeInfo.color);
      chip.append(createElement("span", { className: "type-dot", attrs: { "aria-hidden": "true" } }));
    }
    if (rarityInfo) {
      chip.append(createElement("span", { className: `rarity ${rarityInfo.className}`, text: rarityInfo.key, attrs: { "aria-hidden": "true" } }));
    }
    chip.append(document.createTextNode(text));
    return chip;
  }

  function getRarityBadgeClass(rarityInfo) {
    if (rarityInfo.key === "★" || rarityInfo.key === "☆") {
      return "rare";
    }
    if (rarityInfo.key === "◆") {
      return "uncommon";
    }
    return "common";
  }

  function createRarityBadge(rarityInfo) {
    const badge = createElement("span", {
      className: `rarity-badge rarity-badge--${getRarityBadgeClass(rarityInfo)}`,
      attrs: { "aria-label": `レアリティ ${rarityInfo.key} ${rarityInfo.name}` },
    });
    badge.append(
      createElement("span", {
        className: `rarity ${rarityInfo.className}`,
        text: rarityInfo.key,
        attrs: { "aria-hidden": "true" },
      }),
      document.createTextNode(rarityInfo.name)
    );
    return badge;
  }

  function createMarketLink(label, href) {
    return createElement("a", {
      className: "market-link",
      text: label,
      attrs: {
        href,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    });
  }

  function getCardVariants(card) {
    const variants = variantsByNo[String(card.no)];
    if (Array.isArray(variants) && variants.length > 0) {
      return variants;
    }
    return [
      {
        code: `card-${card.no}`,
        series: "PMCG",
        set: card.release_set || dataset.meta?.set_name_ja || "第1弾 拡張パック",
        image_url: card.image_url,
        source_url: card.source_url,
      },
    ];
  }

  function getVariantSeriesPrefix(variant) {
    if (variant.series === "neo" || variant.series === "VS") {
      return `${variant.series} `;
    }
    return "";
  }

  function shortenSetName(setName) {
    return String(setName || "バリエーション")
      .replace("クイックスターターギフト", "クイックギフト")
      .replace("映画公開記念パック", "映画記念")
      .replace("ポケモンジム", "ジム")
      .replace("イントロパック★neo", "イントロneo")
      .replace("イントロパック", "イントロ")
      .replace("拡張シート", "シート")
      .replace("拡張パック", "拡張");
  }

  function buildVariantViewModels(card) {
    const variants = getCardVariants(card);
    const setCounts = new Map();
    const setIndexes = new Map();

    for (const variant of variants) {
      const setName = variant.set || "バリエーション";
      setCounts.set(setName, (setCounts.get(setName) || 0) + 1);
    }

    return variants.map((variant) => {
      const setName = variant.set || "バリエーション";
      const index = (setIndexes.get(setName) || 0) + 1;
      const suffix = setCounts.get(setName) > 1 && index > 1 ? `（${index}）` : "";
      const prefix = getVariantSeriesPrefix(variant);
      setIndexes.set(setName, index);
      return {
        variant,
        fullLabel: `${prefix}${setName}${suffix}`,
        shortLabel: `${prefix}${shortenSetName(setName)}${suffix}`,
      };
    });
  }

  function selectVariant(card, viewModel, index) {
    const { variant, fullLabel } = viewModel;
    const no = padNo(card.no);
    state.activeVariantIndex = index;

    clearImageFallback(els.modalThumb);
    els.modalFallback.textContent = "";
    els.modalImage.onerror = () => markImageFallback(els.modalThumb, `No.${no}\n${card.name_ja}\n画像なし`);
    els.modalImage.alt = `${card.name_ja} ${fullLabel}のカード画像`;

    if (variant.image_url) {
      els.modalImage.src = variant.image_url;
    } else {
      els.modalImage.removeAttribute("src");
      markImageFallback(els.modalThumb, `No.${no}\n${card.name_ja}\n画像なし`);
    }

    els.modalVariantCaption.textContent = fullLabel;
    for (const button of els.modalVariantStrip.querySelectorAll(".variant-thumb-button")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.variantIndex) === index));
    }
  }

  function buildVariantButton(card, viewModel, index) {
    const { variant, fullLabel, shortLabel } = viewModel;
    const button = createElement("button", {
      className: "variant-thumb-button",
      attrs: {
        type: "button",
        "aria-label": `${fullLabel}版を表示`,
        "aria-pressed": "false",
        "data-variant-index": String(index),
      },
    });
    const frame = createElement("span", { className: "variant-thumb-frame" });
    const imageAttrs = {
      alt: "",
      loading: "lazy",
      decoding: "async",
      width: "64",
      height: "89",
    };
    if (variant.image_url) {
      imageAttrs.src = variant.image_url;
    }
    const image = createElement("img", { attrs: imageAttrs });

    button.title = fullLabel;
    image.addEventListener("error", () => markImageFallback(frame, "画像なし"), { once: true });
    frame.append(
      image,
      createElement("span", { className: "fallback-ball", attrs: { "aria-hidden": "true" } }),
      createElement("span", { className: "fallback-text" })
    );
    if (!variant.image_url) {
      markImageFallback(frame, "画像なし");
    }
    button.append(
      frame,
      createElement("span", { className: "variant-thumb-label", text: shortLabel })
    );
    button.addEventListener("click", () => selectVariant(card, viewModel, index));
    return button;
  }

  function renderVariants(card) {
    const viewModels = buildVariantViewModels(card);
    const fragment = document.createDocumentFragment();

    els.modalVariantsTitle.textContent = `バリエーション ${viewModels.length}種`;
    for (const [index, viewModel] of viewModels.entries()) {
      fragment.append(buildVariantButton(card, viewModel, index));
    }
    els.modalVariantStrip.replaceChildren(fragment);
    selectVariant(card, viewModels[0], 0);
  }

  function renderMarketLinks(card) {
    const yahooQuery = encodeURIComponent(`旧裏 ${card.name_ja}`);
    const marketQuery = encodeURIComponent(`${card.name_ja} 旧裏`);
    const enName = String(card.name_en || "").replace(/[♂♀]/g, "").trim() || card.name_ja;
    const ebayQuery = encodeURIComponent(`${enName} japanese base set`);
    const googleQuery = encodeURIComponent(`ポケカ 旧裏 ${card.name_ja} 相場`);
    els.marketLinks.replaceChildren(
      createMarketLink("Yahoo!フリマ", `https://paypayfleamarket.yahoo.co.jp/search/${yahooQuery}`),
      createMarketLink("メルカリ", `https://jp.mercari.com/search?keyword=${marketQuery}&category_id=1289&status=on_sale`),
      createMarketLink("magi", `https://magi.camp/items/search?forms_search_items%5Bkeyword%5D=${marketQuery}`),
      createMarketLink("スニダン", `https://snkrdunk.com/search?keywords=${marketQuery}&rootCategoryId=6`),
      createMarketLink("eBay", `https://www.ebay.com/sch/i.html?_nkw=${ebayQuery}&_sacat=183454`),
      createMarketLink("Google相場検索", `https://www.google.com/search?q=${googleQuery}`)
    );
  }

  function buildPSAGradeRow(grade, count, total) {
    const safeTotal = Math.max(Number(total) || 0, 0);
    const safeCount = Math.max(Number(count) || 0, 0);
    const percent = safeTotal > 0 ? (safeCount / safeTotal) * 100 : 0;
    const width = Math.min(100, Math.max(0, percent));
    const row = createElement("div", {
      className: `psa-grade-row psa-grade-row--g${grade}`,
    });
    const fill = createElement("span", {
      className: "psa-grade-fill",
      attrs: { "aria-hidden": "true" },
    });
    fill.style.width = `${width}%`;

    row.append(
      createElement("span", { className: "psa-grade-label", text: `PSA${grade}` }),
      createElement("span", {
        className: "psa-grade-track",
        attrs: { "aria-hidden": "true" },
      }),
      createElement("span", { className: "psa-grade-count", text: `${formatNumber(safeCount)}枚` }),
      createElement("span", { className: "psa-grade-percent", text: `${formatPercent(percent)}%` })
    );
    row.querySelector(".psa-grade-track").append(fill);
    return row;
  }

  function renderPSA(card) {
    if (!els.psaSection || !els.psaBody) {
      return;
    }

    const psa = psaByNo[String(card.no)];
    els.psaBody.replaceChildren();
    if (!psa) {
      els.psaSection.hidden = true;
      return;
    }

    els.psaSection.hidden = false;
    const total = Math.max(Number(psa.total) || 0, 0);
    const grades = psa.grades || {};
    const summary = createElement("div", { className: "psa-summary" });
    summary.append(
      createElement("div", {
        className: "psa-metric psa-metric--gem",
        html: '<span class="psa-metric-label">GEM率（PSA10取得率）</span><span class="psa-metric-value"></span><span class="psa-metric-sub">提出した際にPSA10になる割合</span>',
      }),
      createElement("div", {
        className: "psa-metric",
        html: '<span class="psa-metric-label">総鑑定数</span><span class="psa-metric-value"></span><span class="psa-metric-sub">世界累計</span>',
      })
    );
    summary.querySelector(".psa-metric--gem .psa-metric-value").textContent = `${formatPercent(psa.gem_rate)}%`;
    summary.querySelector(".psa-metric:not(.psa-metric--gem) .psa-metric-value").textContent = `${formatNumber(total)}枚`;

    const list = createElement("div", { className: "psa-grade-list" });
    for (let grade = 10; grade >= 1; grade -= 1) {
      const count = Number(grades[`g${grade}`]) || 0;
      if (count > 0) {
        list.append(buildPSAGradeRow(grade, count, total));
      }
    }

    const source = createElement("p", { className: "psa-source" });
    source.append(
      document.createTextNode(`PSA公式データ / 最終更新 ${formatDate(psa.updated)} / `),
      createElement("a", {
        text: "psacard.com",
        attrs: {
          href: "https://www.psacard.com/pop/tcg-cards/1996/pokemon-japanese-basic/55428",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      })
    );

    els.psaBody.append(summary, list, source);
  }

  function buildEvolutionLine(card) {
    if (!card.stage || card.stage === "-") {
      return document.createTextNode("-");
    }
    const line = createElement("span", { className: "evolution-line" });
    const stages = ["たね", "1進化", "2進化"];
    stages.forEach((stage, index) => {
      const item = createElement("span", {
        className: stage === card.stage ? "current" : "",
        text: stage === card.stage ? `${stage}（${card.name_ja}）` : stage,
      });
      line.append(item);
      if (index < stages.length - 1) {
        line.append(document.createTextNode("→"));
      }
    });
    return line;
  }

  function appendDetail(term, value) {
    els.modalDetails.append(createElement("dt", { text: term }));
    const dd = createElement("dd");
    if (value instanceof Node) {
      dd.append(value);
    } else {
      dd.textContent = value;
    }
    els.modalDetails.append(dd);
  }

  function renderModalDetails(card) {
    const typeInfo = getTypeInfo(card);
    const rarityInfo = getRarityInfo(card);
    els.modalDetails.replaceChildren();

    const hp = createElement("span", { className: "hp-strong", text: getHpLabel(card) });
    hp.style.setProperty("--type-color", typeInfo.color);
    appendDetail("HP", hp);

    const typeValue = createElement("span", { className: "summary-chip" });
    typeValue.style.setProperty("--type-color", typeInfo.color);
    typeValue.append(createElement("span", { className: "type-dot", attrs: { "aria-hidden": "true" } }), document.createTextNode(typeInfo.fullLabel));
    appendDetail("属性", typeValue);

    appendDetail("レアリティ", createRarityBadge(rarityInfo));
    appendDetail("進化系統", buildEvolutionLine(card));
    appendDetail("カード番号", `No.${padNo(card.no)}`);
    appendDetail("セット名", card.release_set || dataset.meta?.set_name_ja || "-");
    appendDetail("発売時期", formatDate(card.release_date));
    appendDetail("イラストレーター", card.illustrator || "-");
    appendDetail("その他詳細", card.notes || "-");
  }

  function renderModal(card) {
    const typeInfo = getTypeInfo(card);
    const rarityInfo = getRarityInfo(card);
    const no = padNo(card.no);
    state.activeCardNo = Number(card.no);

    setTypeStyle(els.modalPanel, card);
    setTypeStyle(els.modal, card);
    setTypeStyle(els.modalHeader, card);

    els.modalNo.textContent = `No.${no}`;
    els.modalTitle.textContent = card.name_ja;
    els.modalFallback.textContent = "";
    clearImageFallback(els.modalThumb);

    els.modalChips.replaceChildren(
      createSummaryChip(typeInfo.fullLabel, typeInfo, null),
      createRarityBadge(rarityInfo),
      createSummaryChip(getStageLabel(card), typeInfo, null)
    );
    renderVariants(card);
    renderModalDetails(card);
    renderMarketLinks(card);
    renderPSA(card);

    const index = getCardIndex(card.no);
    els.prevCard.disabled = index <= 0;
    els.nextCard.disabled = index >= cards.length - 1;
    els.prevCard.dataset.targetNo = index > 0 ? String(cards[index - 1].no) : "";
    els.nextCard.dataset.targetNo = index < cards.length - 1 ? String(cards[index + 1].no) : "";
    els.sourceLink.href = card.source_url || "#";
  }

  function setPackageStyle() {
    const color = packageInfo?.theme_color || "#2E5BAA";
    for (const element of [els.packagePanel, els.packageHeader, els.packageImageFrame]) {
      element?.style.setProperty("--package-color", color);
    }
  }

  function renderPackageModal() {
    if (!packageInfo) {
      return;
    }

    setPackageStyle();
    els.packageTitle.textContent = packageInfo.name || "パック詳細";
    els.packageRelease.textContent = formatDate(packageInfo.release_date);
    els.packagePrice.textContent = packageInfo.price || "-";
    els.packagePerPack.textContent = packageInfo.per_pack || "-";
    els.packageTotal.textContent = packageInfo.total || "-";
    els.packageRarity.textContent = packageInfo.rarity || "-";
    els.packageCover.textContent = packageInfo.cover_pokemon || "-";

    clearImageFallback(els.packageImageFrame);
    els.packageImage.onerror = () => markImageFallback(els.packageImageFrame, `${packageInfo.name || "パック"}\n画像なし`);
    els.packageImage.alt = `${packageInfo.name || "パック"}のパッケージ画像`;
    if (packageInfo.image_url) {
      els.packageImage.src = packageInfo.image_url;
    } else {
      els.packageImage.removeAttribute("src");
      markImageFallback(els.packageImageFrame, `${packageInfo.name || "パック"}\n画像なし`);
    }
  }

  function openPackageModal() {
    if (!packageInfo || !els.packageModal) {
      return;
    }
    renderPackageModal();
    if (!els.packageModal.open) {
      if (typeof els.packageModal.showModal === "function") {
        els.packageModal.showModal();
      } else {
        els.packageModal.setAttribute("open", "");
      }
      document.body.classList.add("scroll-locked");
    }
    requestAnimationFrame(() => els.packageClose.focus());
  }

  function closePackageModal({ restoreFocus = true } = {}) {
    if (!els.packageModal?.open) {
      return;
    }
    els.packageModal.close();
    if (!els.modal.open) {
      document.body.classList.remove("scroll-locked");
    }
    if (restoreFocus && els.packageOpen?.isConnected) {
      els.packageOpen.focus();
    }
  }

  function makeUrlWithHash(hash) {
    const url = new URL(location.href);
    url.hash = hash;
    return url;
  }

  function openModal(no, { updateHash = true, push = false, focusSource = null } = {}) {
    const card = getCard(no);
    if (!card) {
      return;
    }
    if (focusSource) {
      state.lastFocusedTile = focusSource;
    } else if (!state.lastFocusedTile && document.activeElement?.matches?.(".card-tile")) {
      state.lastFocusedTile = document.activeElement;
    }

    renderModal(card);
    if (!els.modal.open) {
      if (typeof els.modal.showModal === "function") {
        els.modal.showModal();
      } else {
        els.modal.setAttribute("open", "");
      }
      document.body.classList.add("scroll-locked");
    }
    requestAnimationFrame(() => els.modalClose.focus());

    if (updateHash) {
      const url = makeUrlWithHash(`#no-${padNo(card.no)}`);
      const method = push ? "pushState" : "replaceState";
      if (location.hash !== url.hash) {
        history[method](history.state, "", url);
      }
    }
  }

  function closeModal({ updateHash = true, restoreFocus = true } = {}) {
    if (!els.modal.open) {
      return;
    }
    els.modal.close();
    document.body.classList.remove("scroll-locked");
    state.activeCardNo = null;
    state.activeVariantIndex = 0;

    if (updateHash && /^#no-\d{3}$/.test(location.hash)) {
      const url = makeUrlWithHash("");
      history.pushState(history.state, "", url);
    }
    if (restoreFocus && state.lastFocusedTile?.isConnected) {
      state.lastFocusedTile.focus();
    }
  }

  function navigateModal(direction) {
    if (!state.activeCardNo) {
      return;
    }
    const index = getCardIndex(state.activeCardNo);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= cards.length) {
      return;
    }
    openModal(cards[nextIndex].no, { updateHash: true, push: true });
  }

  function openFromHash() {
    const match = location.hash.match(/^#no-(\d{3})$/);
    if (!match) {
      if (els.modal.open) {
        closeModal({ updateHash: false, restoreFocus: false });
      }
      return;
    }
    openModal(Number(match[1]), { updateHash: false });
  }

  function bindEvents() {
    els.searchInput.addEventListener("input", debounce((event) => {
      state.query = event.target.value.trim();
      applyFilters({ updateUrl: true });
    }, 200));
    els.resetButton.addEventListener("click", resetFilters);
    if (packageInfo && els.packageOpen && els.packageModal) {
      els.packageOpen.addEventListener("click", openPackageModal);
      els.packageClose.addEventListener("click", () => closePackageModal());
      els.packageModal.addEventListener("click", (event) => {
        if (event.target === els.packageModal) {
          closePackageModal();
        }
      });
      els.packageModal.addEventListener("cancel", (event) => {
        event.preventDefault();
        closePackageModal();
      });
    }
    els.modalClose.addEventListener("click", () => closeModal({ updateHash: true }));
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) {
        closeModal({ updateHash: true });
      }
    });
    els.modal.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeModal({ updateHash: true });
    });
    els.prevCard.addEventListener("click", () => navigateModal(-1));
    els.nextCard.addEventListener("click", () => navigateModal(1));
    window.addEventListener("keydown", (event) => {
      if (!els.modal.open) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateModal(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateModal(1);
      }
    });
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener("popstate", openFromHash);
  }

  function init() {
    if (packageInfo && els.packageOpen) {
      els.packageOpen.textContent = packageInfo.name || els.packageOpen.textContent;
      setPackageStyle();
    } else if (els.packageOpen) {
      els.packageOpen.hidden = true;
    }
    renderFilters();
    renderCards();
    setupVariantElements();
    readFiltersFromUrl();
    bindEvents();
    applyFilters();
    openFromHash();
  }

  init();
})();
