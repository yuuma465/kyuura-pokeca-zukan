(() => {
  "use strict";

  const dataset = window.POKECA_ALL || { cards: [] };
  const psaById = window.POKECA_PSA || {};
  const priceById = window.POKECA_PRICE || {};
  const priceHistoryById = window.POKECA_PRICE_HISTORY || {};
  const sourceCards = Array.isArray(dataset.cards) ? dataset.cards : [];
  const oneDayMs = 24 * 60 * 60 * 1000;
  const quoteChartRanges = [
    { key: "week", days: 7 },
    { key: "month", days: 30 },
    { key: "all", days: null },
  ];
  const quoteChartRangeByKey = new Map(quoteChartRanges.map((range) => [range.key, range]));
  const quoteChartLayout = {
    width: 640,
    height: 160,
    top: 14,
    right: 18,
    bottom: 28,
    left: 48,
  };
  const svgNamespace = "http://www.w3.org/2000/svg";
  const firstEditionSetName = "第1弾 拡張パック";
  const favoriteStorageKey = "pokecaFavoritesV1";
  const defaultSortMode = "oldest";

  const seriesOrder = new Map([
    ["PMCG", 0],
    ["neo", 1],
    ["VS", 2],
  ]);
  const regionOrder = new Map([
    ["カントー", 0],
    ["ジョウト", 1],
    ["VS", 2],
  ]);
  const collator = new Intl.Collator("ja-JP", { numeric: true, sensitivity: "base" });

  const typeDefinitions = [
    { key: "草", label: "草", fullLabel: "草", color: "#5BB04A", pokemon: true },
    { key: "炎", label: "炎", fullLabel: "炎", color: "#E8533B", pokemon: true },
    { key: "水", label: "水", fullLabel: "水", color: "#3E8EDE", pokemon: true },
    { key: "雷", label: "雷", fullLabel: "雷", color: "#F2C200", pokemon: true },
    { key: "超", label: "超", fullLabel: "超", color: "#A05BC0", pokemon: true },
    { key: "闘", label: "闘", fullLabel: "闘", color: "#C77B3A", pokemon: true },
    { key: "悪", label: "悪", fullLabel: "悪", color: "#3A332A", pokemon: true },
    { key: "鋼", label: "鋼", fullLabel: "鋼", color: "#8A97A6", pokemon: true },
    { key: "無色", label: "無色", fullLabel: "無色", color: "#C8BFA6", pokemon: true },
    { key: "トレーナー", label: "Tr", fullLabel: "トレーナー", color: "#D98C2B", pokemon: false },
    { key: "エネルギー", label: "En", fullLabel: "エネルギー", color: "#6B5D45", pokemon: false },
  ];
  const typeByKey = new Map(typeDefinitions.map((type) => [type.key, type]));

  const regionDefinitions = [
    { key: "カントー", label: "カントー" },
    { key: "ジョウト", label: "ジョウト" },
    { key: "VS", label: "VS" },
  ];
  const sortOptions = [
    { key: "newest", label: "新しい順" },
    { key: "oldest", label: "古い順" },
    { key: "price-asc", label: "安い順" },
    { key: "price-desc", label: "高い順" },
    { key: "change-desc", label: "価格上昇順" },
    { key: "change-asc", label: "価格下落順" },
  ];
  const sortOptionByKey = new Map(sortOptions.map((option) => [option.key, option]));

  const kindDefinitions = [
    { key: "ポケモン", label: "ポケモン" },
    { key: "トレーナー", label: "トレーナー" },
    { key: "エネルギー", label: "エネルギー" },
  ];

  const rarityDefinitions = [
    { key: "●", label: "●", name: "コモン", className: "rarity--common" },
    { key: "◆", label: "◆", name: "アンコモン", className: "rarity--uncommon" },
    { key: "★", label: "★", name: "レア", className: "rarity--rare" },
  ];
  const rarityByKey = new Map(rarityDefinitions.map((rarity) => [rarity.key, rarity]));

  const editionDefinitions = [
    { key: "first", label: "初版あり" },
    { key: "no-first", label: "初版なし" },
  ];

  const initialSetOrder = buildInitialSetOrder(sourceCards);
  const cards = sortCards(sourceCards);
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const totalCount = cards.length;

  function setKey(card) {
    return `${card.series || ""}\u0000${card.region || ""}\u0000${card.set || ""}`;
  }

  function buildInitialSetOrder(cardList) {
    const order = new Map();
    for (const card of cardList) {
      const key = setKey(card);
      if (!order.has(key)) {
        order.set(key, order.size);
      }
    }
    return order;
  }

  function parseCardNumber(cardNumber) {
    const text = String(cardNumber || "").trim();
    const match = text.match(/^(\d+)(?:\s*\/\s*(\d+))?$/);
    if (!match) {
      return { missing: true, number: Number.MAX_SAFE_INTEGER, total: Number.MAX_SAFE_INTEGER };
    }
    return {
      missing: false,
      number: Number(match[1]),
      total: Number(match[2] || Number.MAX_SAFE_INTEGER),
    };
  }

  function compareCards(a, b) {
    const seriesDiff = (seriesOrder.get(a.series) ?? 99) - (seriesOrder.get(b.series) ?? 99);
    if (seriesDiff) {
      return seriesDiff;
    }

    const regionDiff = (regionOrder.get(a.region) ?? 99) - (regionOrder.get(b.region) ?? 99);
    if (regionDiff) {
      return regionDiff;
    }

    const setDiff = (initialSetOrder.get(setKey(a)) ?? Number.MAX_SAFE_INTEGER) - (initialSetOrder.get(setKey(b)) ?? Number.MAX_SAFE_INTEGER);
    if (setDiff) {
      return setDiff;
    }

    const setNameDiff = collator.compare(a.set || "", b.set || "");
    if (setNameDiff) {
      return setNameDiff;
    }

    const aNo = parseCardNumber(a.card_number);
    const bNo = parseCardNumber(b.card_number);
    if (aNo.missing !== bNo.missing) {
      return aNo.missing ? 1 : -1;
    }
    if (aNo.number !== bNo.number) {
      return aNo.number - bNo.number;
    }
    return collator.compare(a.id || "", b.id || "");
  }

  function sortCards(cardList) {
    return [...cardList].sort(compareCards);
  }

  function getSortableQuote(card) {
    return getPSA10Quote(card) || getSelectedEditionQuote(card, getDefaultModalEdition(card));
  }

  function getPriceChangeMetric(card) {
    const points = getPriceHistoryPoints(card);
    if (points.length < 2) {
      return null;
    }
    const latest = points.at(-1);
    const previous = points.at(-2);
    const change = Number(latest.sell) - Number(previous.sell);
    return Number.isFinite(change) ? change : null;
  }

  function getSortMetric(card, sortMode) {
    if (sortMode === "price-asc" || sortMode === "price-desc") {
      const quote = getSortableQuote(card);
      const sell = Number(quote?.sell);
      return Number.isFinite(sell) ? sell : null;
    }
    if (sortMode === "change-asc" || sortMode === "change-desc") {
      return getPriceChangeMetric(card);
    }
    return null;
  }

  function compareMetricCards(a, b, sortMode, direction) {
    const aMetric = getSortMetric(a, sortMode);
    const bMetric = getSortMetric(b, sortMode);
    const aMissing = !Number.isFinite(aMetric);
    const bMissing = !Number.isFinite(bMetric);
    if (aMissing || bMissing) {
      if (aMissing && bMissing) {
        return compareCards(a, b);
      }
      return aMissing ? 1 : -1;
    }
    const diff = (aMetric - bMetric) * direction;
    return diff || compareCards(a, b);
  }

  function sortCardsByMode(cardList, sortMode = defaultSortMode) {
    const mode = sortOptionByKey.has(sortMode) ? sortMode : defaultSortMode;
    if (mode === "newest") {
      return [...cardList].sort((a, b) => compareCards(b, a));
    }
    if (mode === "price-asc") {
      return [...cardList].sort((a, b) => compareMetricCards(a, b, mode, 1));
    }
    if (mode === "price-desc" || mode === "change-desc") {
      return [...cardList].sort((a, b) => compareMetricCards(a, b, mode, -1));
    }
    if (mode === "change-asc") {
      return [...cardList].sort((a, b) => compareMetricCards(a, b, mode, 1));
    }
    return sortCards(cardList);
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
    return symbol || "-";
  }

  const genericSearchTokens = new Set([
    "旧裏",
    "旧裏面",
    "ポケカ",
    "ポケモンカード",
    "ポケモンカードゲーム",
    "カード",
    "pokemoncard",
    "pokeca",
  ]);

  function normalizeQueryTokens(value) {
    return String(value || "")
      .trim()
      .split(/\s+/)
      .map(normalizeText)
      .filter((token) => token && !genericSearchTokens.has(token));
  }

  function getCardKind(card) {
    if (card.hp !== null && card.hp !== undefined && card.hp !== "") {
      return "ポケモン";
    }
    if (card.type) {
      return "ポケモン";
    }
    if (card.card_type === "エネルギー") {
      return "エネルギー";
    }
    if (card.card_type === "トレーナー") {
      return "トレーナー";
    }
    return "トレーナー";
  }

  function getTypeKey(card) {
    const kind = getCardKind(card);
    if (kind === "ポケモン") {
      return card.type || "無色";
    }
    return kind;
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
      name: key === "-" ? "なし" : key,
      className: "rarity--none",
    };
  }

  function isPSAPopulation(psa) {
    return Boolean(psa) && (psa.status === "population" || (!psa.status && psa.total !== undefined));
  }

  function hasPSAData(card) {
    return isPSAPopulation(psaById[card.id]);
  }

  function normalizeQuoteEntry(entry, fallbackUpdated = "") {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const buy = Number(entry.buy);
    const sell = Number(entry.sell);
    if (!Number.isFinite(buy) || !Number.isFinite(sell)) {
      return null;
    }
    return {
      buy,
      sell,
      n: Number.isFinite(Number(entry.n)) ? Number(entry.n) : 0,
      updated: entry.updated || fallbackUpdated || "",
    };
  }

  function getQuoteEditionEntry(quote, editionKey) {
    if (!quote || typeof quote !== "object") {
      return null;
    }
    const editionQuote = normalizeQuoteEntry(quote.editions?.[editionKey], quote.updated);
    if (editionQuote) {
      return editionQuote;
    }
    if (editionKey === "unlimited" || editionKey === "standard") {
      return normalizeQuoteEntry(quote);
    }
    return null;
  }

  function hasFirstEditionVariant(card) {
    return String(card?.set || "") === firstEditionSetName;
  }

  function getEditionOptions(card) {
    if (!hasFirstEditionVariant(card)) {
      return [{ key: "standard", label: "通常版", shortLabel: "通常版" }];
    }
    return [
      { key: "unlimited", label: "通常版（マークあり）", shortLabel: "マークあり" },
      { key: "first", label: "初版（マークなし）", shortLabel: "マークなし" },
    ];
  }

  function getDefaultModalEdition(card) {
    return hasFirstEditionVariant(card) ? "unlimited" : "standard";
  }

  function normalizeModalEdition(card, editionKey) {
    const options = getEditionOptions(card);
    return options.some((item) => item.key === editionKey) ? editionKey : getDefaultModalEdition(card);
  }

  function getEditionInfo(card, editionKey = "") {
    if (!editionKey) {
      if (hasFirstEditionVariant(card)) {
        return {
          key: "first",
          label: "初版（マークなし）あり",
          detail: "通常版（マークあり）と初版（マークなし）の版違いがあります",
        };
      }
      return {
        key: "no-first",
        label: "初版なし",
        detail: "初版（マークなし）対象外のカードです",
      };
    }
    const normalizedEdition = normalizeModalEdition(card, editionKey || getDefaultModalEdition(card));
    if (hasFirstEditionVariant(card) && normalizedEdition === "first") {
      return {
        key: "first",
        label: "初版（マークなし）",
        detail: "初版（マークなし）を表示中です",
      };
    }
    if (hasFirstEditionVariant(card)) {
      return {
        key: "unlimited",
        label: "通常版（マークあり）",
        detail: "通常版（マークあり）を表示中です。初版（マークなし）へ切替できます",
      };
    }
    return {
      key: "standard",
      label: "通常版",
      detail: "初版（マークなし）対象外のカードです",
    };
  }

  function cardMatchesEdition(card, selectedEditions) {
    if (!selectedEditions || selectedEditions.size === 0) {
      return true;
    }
    const hasFirst = hasFirstEditionVariant(card);
    return (hasFirst && selectedEditions.has("first")) || (!hasFirst && selectedEditions.has("no-first"));
  }

  function getEditionSearchText(card) {
    return hasFirstEditionVariant(card)
      ? "初版 マークなし 無記号 通常版 マークあり 版違い"
      : "初版なし 通常版";
  }

  function getEditionQuotes(card) {
    const quote = priceById[card.id];
    if (!quote) {
      return [];
    }
    if (hasFirstEditionVariant(card)) {
      return [
        {
          key: "first",
          label: "初版（マークなし）",
          modifier: "first",
          quote: getQuoteEditionEntry(quote, "first"),
          emptyText: "初版相場は未取得です",
        },
        {
          key: "unlimited",
          label: "通常版（マークあり）",
          modifier: "unlimited",
          quote: getQuoteEditionEntry(quote, "unlimited"),
          emptyText: "通常版相場は未取得です",
        },
      ];
    }
    return [
      {
        key: "standard",
        label: "通常版",
        modifier: "standard",
        quote: getQuoteEditionEntry(quote, "standard"),
        emptyText: "相場は未取得です",
      },
    ];
  }

  function hasQuoteData(card) {
    return getEditionQuotes(card).some((item) => item.quote);
  }

  function getSelectedEditionQuote(card, editionKey = "") {
    const normalizedEdition = normalizeModalEdition(card, editionKey || getDefaultModalEdition(card));
    return getEditionQuotes(card).find((item) => item.key === normalizedEdition)?.quote || null;
  }

  function getPSAEntry(card, editionKey = "") {
    const psa = psaById[card.id];
    const normalizedEdition = normalizeModalEdition(card, editionKey || getDefaultModalEdition(card));
    const editionEntry = psa?.editions?.[normalizedEdition];
    if (editionEntry) {
      return editionEntry;
    }
    return psa || null;
  }

  function getPSA10Quote(card) {
    const quote = priceById[card.id];
    if (!quote || typeof quote !== "object") {
      return null;
    }
    return normalizeQuoteEntry(
      quote.psa10 || quote.psa10_jp || quote.psa_10 || quote.psa?.g10 || quote.grades?.psa10,
      quote.updated,
    );
  }

  function getCardImageUrl(card, editionKey = "") {
    const variants = card?.image_variants && typeof card.image_variants === "object" ? card.image_variants : {};
    const normalizedEdition = normalizeModalEdition(card, editionKey || state.activeEditionKey || getDefaultModalEdition(card));
    return variants[normalizedEdition] || variants.standard || variants.unlimited || card?.image_url || "";
  }

  function getPSA10TileLabel(card) {
    const quote = getPSA10Quote(card);
    return quote ? formatYen(quote.sell) : "未取得";
  }

  function cardMatchesQuery(card, query) {
    const tokens = normalizeQueryTokens(query);
    if (!tokens.length) {
      return true;
    }
    const haystack = normalizeText(`${card.name_ja} ${card.name_en} ${card.card_number} ${card.id} ${card.set} ${card.series} ${getEditionSearchText(card)}`);
    return tokens.every((token) => haystack.includes(token));
  }

  function filterCards(cardList, filters) {
    const selectedRegions = filters.selectedRegions || new Set();
    const selectedKinds = filters.selectedKinds || new Set();
    const selectedTypes = filters.selectedTypes || new Set();
    const selectedRarities = filters.selectedRarities || new Set();
    const selectedEditions = filters.selectedEditions || new Set();
    const selectedSet = filters.selectedSet || "";
    const favoriteIds = filters.favoriteIds || new Set();
    const query = filters.query || "";

    return cardList.filter((card) => {
      const kind = getCardKind(card);
      const type = getTypeKey(card);
      const rarity = normalizeRarity(card.rarity);
      return (
        (selectedRegions.size === 0 || selectedRegions.has(card.region)) &&
        (!selectedSet || card.set === selectedSet) &&
        (selectedKinds.size === 0 || selectedKinds.has(kind)) &&
        (selectedTypes.size === 0 || selectedTypes.has(type)) &&
        (selectedRarities.size === 0 || selectedRarities.has(rarity)) &&
        cardMatchesEdition(card, selectedEditions) &&
        (!filters.psaOnly || hasPSAData(card)) &&
        (!filters.favoriteOnly || favoriteIds.has(card.id)) &&
        cardMatchesQuery(card, query)
      );
    });
  }

  function groupCards(cardList) {
    const regions = [];
    const regionMap = new Map();

    for (const card of cardList) {
      if (!regionMap.has(card.region)) {
        const regionGroup = { region: card.region, sets: [], count: 0, setMap: new Map() };
        regionMap.set(card.region, regionGroup);
        regions.push(regionGroup);
      }

      const regionGroup = regionMap.get(card.region);
      if (!regionGroup.setMap.has(card.set)) {
        const setGroup = { set: card.set, cards: [] };
        regionGroup.setMap.set(card.set, setGroup);
        regionGroup.sets.push(setGroup);
      }

      regionGroup.setMap.get(card.set).cards.push(card);
      regionGroup.count += 1;
    }

    return regions.map((regionGroup) => ({
      region: regionGroup.region,
      count: regionGroup.count,
      sets: regionGroup.sets,
    }));
  }

  function getHashForCard(card) {
    return `#id-${encodeURIComponent(card.id)}`;
  }

  function getIdFromHash(hash) {
    const match = String(hash || "").match(/^#id-(.+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function parseHistoryDate(dateText) {
    const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return NaN;
    }
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  function normalizePriceHistoryPoint(point) {
    const date = String(point?.date || "").trim();
    const time = parseHistoryDate(date);
    const buy = Number(point?.buy);
    const sell = Number(point?.sell);
    if (!date || !Number.isFinite(time) || !Number.isFinite(buy) || !Number.isFinite(sell)) {
      return null;
    }
    return { date, time, buy, sell };
  }

  function normalizePriceHistory(points, editionKey = "") {
    if (!Array.isArray(points)) {
      return [];
    }
    return points
      .map((point) => {
        if (editionKey && point?.editions?.[editionKey]) {
          return normalizePriceHistoryPoint({ date: point.date, ...point.editions[editionKey] });
        }
        return normalizePriceHistoryPoint(point);
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);
  }

  function getPriceHistoryPoints(cardOrId, editionKey = "") {
    const id = typeof cardOrId === "string" ? cardOrId : cardOrId?.id;
    return normalizePriceHistory(priceHistoryById[id] || [], editionKey);
  }

  function resolvePriceHistoryRange(points, rangeKey = "all") {
    const normalized = normalizePriceHistory(points);
    const requestedKey = quoteChartRangeByKey.has(rangeKey) ? rangeKey : "all";
    const range = quoteChartRangeByKey.get(requestedKey) || quoteChartRangeByKey.get("all");
    if (!normalized.length || !range?.days) {
      return { rangeKey: "all", points: normalized };
    }

    const latestTime = normalized.at(-1).time;
    const fromTime = latestTime - (range.days - 1) * oneDayMs;
    const filtered = normalized.filter((point) => point.time >= fromTime && point.time <= latestTime);
    if (!filtered.length) {
      return { rangeKey: "all", points: normalized };
    }
    return { rangeKey: requestedKey, points: filtered };
  }

  function filterPriceHistoryPoints(points, rangeKey = "all") {
    return resolvePriceHistoryRange(points, rangeKey).points;
  }

  function formatChartDate(dateText) {
    const match = String(dateText || "").match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!match) {
      return dateText || "-";
    }
    return `${Number(match[1])}/${Number(match[2])}`;
  }

  function roundSvgNumber(value) {
    return String(Math.round(value * 100) / 100);
  }

  function buildSvgPath(points, yKey) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${roundSvgNumber(point.x)} ${roundSvgNumber(point[yKey])}`)
      .join(" ");
  }

  function buildSmoothSvgPath(points, yKey) {
    if (!points.length) {
      return "";
    }
    const firstPoint = points[0];
    const path = [`M ${roundSvgNumber(firstPoint.x)} ${roundSvgNumber(firstPoint[yKey])}`];
    for (let index = 0; index < points.length - 1; index += 1) {
      const previous = points[index - 1] || points[index];
      const current = points[index];
      const next = points[index + 1];
      const after = points[index + 2] || next;
      const cp1x = current.x + (next.x - previous.x) / 6;
      const cp1y = current[yKey] + (next[yKey] - previous[yKey]) / 6;
      const cp2x = next.x - (after.x - current.x) / 6;
      const cp2y = next[yKey] - (after[yKey] - current[yKey]) / 6;
      path.push(
        `C ${roundSvgNumber(cp1x)} ${roundSvgNumber(cp1y)} ` +
        `${roundSvgNumber(cp2x)} ${roundSvgNumber(cp2y)} ` +
        `${roundSvgNumber(next.x)} ${roundSvgNumber(next[yKey])}`,
      );
    }
    return path.join(" ");
  }

  function buildQuoteChartModel(points, rangeKey = "all") {
    const resolved = resolvePriceHistoryRange(points, rangeKey);
    const selectedPoints = resolved.points;
    const layout = quoteChartLayout;
    if (!selectedPoints.length) {
      return {
        mode: "empty",
        rangeKey: resolved.rangeKey,
        points: [],
        yMin: 0,
        yMax: 0,
        yTicks: [],
        sellPath: "",
        buyPath: "",
        sellAreaPath: "",
        latest: null,
        layout,
      };
    }

    const rawValues = selectedPoints.map((point) => point.sell);
    const rawMin = Math.min(...rawValues);
    const rawMax = Math.max(...rawValues);
    const rawRange = rawMax - rawMin;
    const padding = rawRange > 0 ? rawRange * 0.12 : Math.max(rawMax * 0.08, 100);
    const yMin = Math.max(0, rawMin - padding);
    const yMax = rawMax + padding;
    const plotWidth = layout.width - layout.left - layout.right;
    const plotHeight = layout.height - layout.top - layout.bottom;
    const firstTime = selectedPoints[0].time;
    const lastTime = selectedPoints.at(-1).time;
    const timeRange = lastTime - firstTime;
    const valueRange = yMax - yMin || 1;
    const baselineY = layout.height - layout.bottom;

    const chartPoints = selectedPoints.map((point, index) => {
      const ratio = selectedPoints.length === 1
        ? 0.5
        : timeRange > 0
          ? (point.time - firstTime) / timeRange
          : index / Math.max(selectedPoints.length - 1, 1);
      const x = layout.left + ratio * plotWidth;
      const ySell = layout.top + (1 - (point.sell - yMin) / valueRange) * plotHeight;
      return { ...point, index, x, ySell };
    });

    const yTicks = [yMax, (yMax + yMin) / 2, yMin].map((value) => ({
      value,
      y: layout.top + (1 - (value - yMin) / valueRange) * plotHeight,
    }));
    const sellPath = chartPoints.length > 1
      ? buildSmoothSvgPath(chartPoints, "ySell")
      : buildSvgPath(chartPoints, "ySell");
    const sellAreaPath = chartPoints.length > 1
      ? `${sellPath} L ${roundSvgNumber(chartPoints.at(-1).x)} ${roundSvgNumber(baselineY)} L ${roundSvgNumber(chartPoints[0].x)} ${roundSvgNumber(baselineY)} Z`
      : "";

    return {
      mode: chartPoints.length > 1 ? "line" : "single",
      rangeKey: resolved.rangeKey,
      points: chartPoints,
      yMin,
      yMax,
      yTicks,
      sellPath,
      buyPath: "",
      sellAreaPath,
      latest: chartPoints.at(-1),
      layout,
    };
  }

  function getQuoteChartPointLabel(point) {
    if (!point) {
      return "";
    }
    return `${formatDate(point.date)} 販売 ${formatYen(point.sell)}`;
  }

  window.POKECA_APP_TESTS = {
    normalizeText,
    sortOptions,
    sortCards,
    sortCardsByMode,
    getSortMetric,
    getPriceChangeMetric,
    groupCards,
    filterCards,
    getCardKind,
    getTypeKey,
    getHashForCard,
    getIdFromHash,
    hasPSAData,
    hasQuoteData,
    hasFirstEditionVariant,
    getEditionOptions,
    getDefaultModalEdition,
    normalizeModalEdition,
    getEditionInfo,
    getEditionQuotes,
    getSelectedEditionQuote,
    getPSAEntry,
    getPSA10Quote,
    getCardImageUrl,
    getPSA10TileLabel,
    getPriceHistoryPoints,
    filterPriceHistoryPoints,
    buildQuoteChartModel,
    getQuoteChartPointLabel,
    formatYen,
    formatDate,
    formatChartDate,
    parseCardNumber,
  };

  if (window.POKECA_APP_SKIP_INIT) {
    return;
  }

  const state = {
    selectedRegions: new Set(),
    selectedSet: "",
    selectedKinds: new Set(),
    selectedTypes: new Set(),
    selectedRarities: new Set(),
    selectedEditions: new Set(),
    psaOnly: false,
    favoriteOnly: false,
    favoriteIds: loadFavoriteIds(),
    query: "",
    sortMode: defaultSortMode,
    advancedFiltersOpen: false,
    visibleCards: [...cards],
    activeCardId: null,
    activeEditionKey: "",
    lastFocusedTile: null,
    quoteChartRange: "all",
  };

  const els = {
    grid: document.getElementById("card-grid"),
    resultCount: document.getElementById("result-count"),
    emptyState: document.getElementById("empty-state"),
    homeResetButton: document.getElementById("home-reset-button"),
    searchInput: document.getElementById("search-input"),
    quickSearchInput: document.getElementById("quick-search-input"),
    quickSearchClear: document.getElementById("quick-search-clear"),
    resetButton: document.getElementById("reset-button"),
    sortButton: document.getElementById("sort-button"),
    sortMenu: document.getElementById("sort-menu"),
    advancedFilterToggle: document.getElementById("advanced-filter-toggle"),
    advancedFilters: document.getElementById("advanced-filters"),
    regionFilters: document.getElementById("region-filters"),
    setFilter: document.getElementById("set-filter"),
    kindFilters: document.getElementById("kind-filters"),
    typeFilters: document.getElementById("type-filters"),
    rarityFilters: document.getElementById("rarity-filters"),
    editionFilters: document.getElementById("edition-filters"),
    psaOnly: document.getElementById("psa-only"),
    favoritesOnly: document.getElementById("favorites-only"),
    modal: document.getElementById("card-modal"),
    modalPanel: document.querySelector(".modal-panel"),
    modalHeader: document.querySelector(".modal-header"),
    modalClose: document.getElementById("modal-close"),
    modalNo: document.getElementById("modal-no"),
    modalTitle: document.getElementById("modal-title"),
    modalThumb: document.getElementById("modal-thumb"),
    modalImage: document.getElementById("modal-image"),
    modalFallback: document.getElementById("modal-fallback"),
    modalCaption: document.getElementById("modal-caption"),
    modalChips: document.getElementById("modal-chips"),
    modalEditionSwitch: document.getElementById("modal-edition-switch"),
    modalDetails: document.getElementById("modal-details"),
    marketLinks: document.getElementById("market-links"),
    quoteSection: document.getElementById("quote-section"),
    quoteBody: document.getElementById("quote-body"),
    quoteChartWrap: document.querySelector(".quote-chart-wrap"),
    quoteChartTabs: document.querySelector(".quote-chart-tabs"),
    quoteChart: document.getElementById("quote-chart"),
    psaSection: document.getElementById("psa-section"),
    psaBody: document.getElementById("psa-body"),
    prevCard: document.getElementById("prev-card"),
    nextCard: document.getElementById("next-card"),
    sourceLink: document.getElementById("source-link"),
  };

  const tileById = new Map();

  function loadFavoriteIds() {
    try {
      const raw = window.localStorage?.getItem(favoriteStorageKey);
      const parsed = JSON.parse(raw || "[]");
      return new Set(Array.isArray(parsed) ? parsed.filter((id) => cardById.has(id)) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveFavoriteIds() {
    try {
      window.localStorage?.setItem(favoriteStorageKey, JSON.stringify([...state.favoriteIds]));
    } catch (error) {
      // localStorageが使えない環境では、このセッション内だけで保持する。
    }
  }

  function isFavorite(cardOrId) {
    const id = typeof cardOrId === "string" ? cardOrId : cardOrId?.id;
    return state.favoriteIds.has(id);
  }

  function createFavoriteIcon(active) {
    const icon = createSvgElement("svg", {
      class: "favorite-icon",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      focusable: "false",
    });
    icon.append(createSvgElement("path", {
      d: "M12 20.2 4.9 13.6C1.1 10 3.5 3.8 8.6 3.8c1.8 0 3.4.9 4.4 2.3 1-1.4 2.6-2.3 4.4-2.3 5.1 0 7.5 6.2 3.7 9.8L12 20.2Z",
      fill: active ? "currentColor" : "none",
    }));
    return icon;
  }

  function updateFavoriteButton(button, card) {
    const active = isFavorite(card);
    button.classList.toggle("is-favorite", active);
    button.replaceChildren(createFavoriteIcon(active));
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute("aria-label", active ? `${card.name_ja}をお気に入りから外す` : `${card.name_ja}をお気に入りに追加`);
    button.title = active ? "お気に入りから外す" : "お気に入りに追加";
  }

  function buildFavoriteButton(card) {
    const button = createElement("button", {
      className: "favorite-button",
      attrs: {
        type: "button",
        "data-favorite-id": card.id,
      },
    });
    updateFavoriteButton(button, card);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(card.id);
    });
    return button;
  }

  function updateFavoriteButtons(cardId) {
    for (const button of document.querySelectorAll(`[data-favorite-id="${cssEscape(cardId)}"]`)) {
      const card = cardById.get(cardId);
      if (card) {
        updateFavoriteButton(button, card);
      }
    }
  }

  function toggleFavorite(cardId) {
    if (state.favoriteIds.has(cardId)) {
      state.favoriteIds.delete(cardId);
    } else {
      state.favoriteIds.add(cardId);
    }
    saveFavoriteIds();
    if (state.favoriteOnly) {
      applyFilters({ updateUrl: true });
      return;
    }
    updateFavoriteButtons(cardId);
  }

  function updateQuickSearchAvoidance() {
    const viewport = window.visualViewport;
    if (!viewport) {
      document.documentElement.style.setProperty("--quick-search-avoid-bottom", "0px");
      return;
    }

    const layoutHeight = window.innerHeight || document.documentElement.clientHeight || viewport.height;
    const bottomInset = Math.max(0, layoutHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty("--quick-search-avoid-bottom", `${Math.ceil(bottomInset)}px`);
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("ja-JP") : "0";
  }

  function formatYen(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `¥${number.toLocaleString("ja-JP")}` : "¥0";
  }

  function formatPercent(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) : "0.0";
  }

  function formatDate(dateText) {
    const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return dateText || "-";
    }
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function formatCompactYen(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return "¥0";
    }
    if (Math.abs(number) >= 10000) {
      const man = number / 10000;
      const text = Number.isInteger(man) ? String(man) : man.toFixed(1).replace(/\.0$/, "");
      return `¥${text}万`;
    }
    return formatYen(number);
  }

  function getCardNumberLabel(card) {
    const number = String(card.card_number || "").trim();
    return number && number !== "-/-" ? number : "番号なし";
  }

  function getHpLabel(card) {
    return Number.isFinite(Number(card.hp)) ? `HP${card.hp}` : "HP -";
  }

  function getStageLabel(card) {
    if (getCardKind(card) !== "ポケモン") {
      return getCardKind(card);
    }
    return card.stage || "ポケモン";
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

  function createSvgElement(tag, attrs = {}) {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [key, value] of Object.entries(attrs)) {
      element.setAttribute(key, String(value));
    }
    return element;
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function setTypeStyle(element, cardOrKey) {
    element?.style.setProperty("--type-color", getTypeInfo(cardOrKey).color);
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

  function buildChipButton(definition, group) {
    const button = createElement("button", {
      className: "filter-chip",
      attrs: {
        type: "button",
        "aria-pressed": "false",
        "data-filter-group": group,
        "data-filter-key": definition.key,
      },
    });
    if (definition.color) {
      button.style.setProperty("--type-color", definition.color);
      button.append(createElement("span", { className: "chip-dot", attrs: { "aria-hidden": "true" } }));
    }
    if (definition.className) {
      button.append(createElement("span", { className: `rarity ${definition.className}`, text: definition.label, attrs: { "aria-hidden": "true" } }));
      button.append(document.createTextNode(definition.name));
    } else {
      button.append(document.createTextNode(definition.label));
    }
    button.addEventListener("click", () => toggleFilter(group, definition.key));
    return button;
  }

  function renderFilters() {
    for (const region of regionDefinitions) {
      els.regionFilters.append(buildChipButton(region, "region"));
    }

    const setCounts = new Map();
    for (const card of cards) {
      setCounts.set(card.set, (setCounts.get(card.set) || 0) + 1);
    }
    const seenSets = new Set();
    for (const card of cards) {
      if (seenSets.has(card.set)) {
        continue;
      }
      seenSets.add(card.set);
      els.setFilter.append(createElement("option", {
        text: `${card.set}（${formatNumber(setCounts.get(card.set))}）`,
        attrs: { value: card.set },
      }));
    }

    for (const kind of kindDefinitions) {
      els.kindFilters.append(buildChipButton(kind, "kind"));
    }

    const presentTypes = new Set(cards.filter((card) => getCardKind(card) === "ポケモン").map((card) => getTypeKey(card)));
    for (const type of typeDefinitions.filter((item) => item.pokemon && presentTypes.has(item.key))) {
      els.typeFilters.append(buildChipButton(type, "type"));
    }

    const presentRarities = new Set(cards.map((card) => normalizeRarity(card.rarity)));
    for (const rarity of rarityDefinitions.filter((item) => presentRarities.has(item.key))) {
      els.rarityFilters.append(buildChipButton(rarity, "rarity"));
    }

    for (const edition of editionDefinitions) {
      els.editionFilters?.append(buildChipButton(edition, "edition"));
    }
  }

  function getStateSet(group) {
    if (group === "region") {
      return state.selectedRegions;
    }
    if (group === "kind") {
      return state.selectedKinds;
    }
    if (group === "type") {
      return state.selectedTypes;
    }
    if (group === "edition") {
      return state.selectedEditions;
    }
    return state.selectedRarities;
  }

  function toggleFilter(group, key) {
    const set = getStateSet(group);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    applyFilters({ updateUrl: true });
  }

  function updateFilterControls() {
    for (const button of document.querySelectorAll("[data-filter-group][data-filter-key]")) {
      const group = button.getAttribute("data-filter-group");
      const key = button.getAttribute("data-filter-key");
      button.setAttribute("aria-pressed", String(getStateSet(group).has(key)));
    }
    els.setFilter.value = state.selectedSet;
    els.psaOnly.checked = state.psaOnly;
    if (els.favoritesOnly) {
      els.favoritesOnly.checked = state.favoriteOnly;
    }
    updateSortControls();
    if (hasAdvancedFiltersActive()) {
      setAdvancedFiltersOpen(true);
    } else {
      setAdvancedFiltersOpen(state.advancedFiltersOpen);
    }
  }

  function setSearchInputs(value) {
    const text = String(value || "");
    els.searchInput.value = text;
    if (els.quickSearchInput) {
      els.quickSearchInput.value = text;
    }
    if (els.quickSearchClear) {
      els.quickSearchClear.hidden = text.length === 0;
    }
  }

  function setSortMenuOpen(open) {
    if (!els.sortButton || !els.sortMenu) {
      return;
    }
    els.sortButton.setAttribute("aria-expanded", String(open));
    els.sortMenu.hidden = !open;
  }

  function updateSortControls() {
    const mode = sortOptionByKey.has(state.sortMode) ? state.sortMode : defaultSortMode;
    for (const button of els.sortMenu?.querySelectorAll("[data-sort-mode]") || []) {
      button.setAttribute("aria-checked", String(button.getAttribute("data-sort-mode") === mode));
    }
  }

  function selectSortMode(sortMode) {
    if (!sortOptionByKey.has(sortMode)) {
      return;
    }
    state.sortMode = sortMode;
    setSortMenuOpen(false);
    applyFilters({ updateUrl: true });
  }

  function setAdvancedFiltersOpen(open) {
    state.advancedFiltersOpen = Boolean(open);
    if (els.advancedFilters) {
      els.advancedFilters.hidden = !state.advancedFiltersOpen;
    }
    if (els.advancedFilterToggle) {
      els.advancedFilterToggle.setAttribute("aria-expanded", String(state.advancedFiltersOpen));
    }
  }

  function hasAdvancedFiltersActive() {
    return Boolean(
      state.selectedSet ||
      state.selectedKinds.size ||
      state.selectedTypes.size ||
      state.selectedRarities.size ||
      state.selectedEditions.size ||
      state.psaOnly ||
      state.favoriteOnly,
    );
  }

  function buildTile(card) {
    const typeInfo = getTypeInfo(card);
    const numberLabel = getCardNumberLabel(card);
    const tile = createElement("article", {
      className: "card-tile",
      attrs: {
        role: "button",
        tabindex: "0",
        "data-id": card.id,
        "data-type": typeInfo.key,
        "aria-label": `${numberLabel} ${card.name_ja} の詳細を開く`,
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
    img.addEventListener("error", () => markImageFallback(thumb, `${numberLabel}\n${card.name_ja}\n画像なし`), { once: true });
    const favoriteButton = buildFavoriteButton(card);
    thumb.append(
      img,
      createElement("span", { className: "fallback-ball", attrs: { "aria-hidden": "true" } }),
      createElement("span", { className: "fallback-text" }),
      favoriteButton,
    );

    const marketRow = createElement("span", { className: "tile-market-row" });
    const psa10Quote = getPSA10Quote(card);
    const psa10Market = createElement("span", {
      className: `psa10-market${psa10Quote ? "" : " psa10-market--empty"}`,
    });
    psa10Market.append(
      createElement("span", { className: "psa10-market-label", text: "PSA10相場" }),
      createElement("span", { className: "psa10-market-value", text: getPSA10TileLabel(card) }),
    );
    marketRow.append(psa10Market);

    const tileInfo = createElement("span", { className: "tile-info" });
    const typeDot = createElement("span", { className: "type-dot", attrs: { "aria-label": typeInfo.fullLabel } });
    typeDot.style.setProperty("--type-color", typeInfo.color);
    tileInfo.append(
      createElement("span", { className: "tile-name", text: card.name_ja }),
      typeDot,
    );

    tile.append(
      thumb,
      marketRow,
    );
    tile.append(tileInfo);
    tile.addEventListener("click", () => openModal(card.id, { updateHash: true, push: true, focusSource: tile }));
    tile.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      if (event.target?.closest?.(".favorite-button")) {
        return;
      }
      event.preventDefault();
      openModal(card.id, { updateHash: true, push: true, focusSource: tile });
    });
    tileById.set(card.id, tile);
    return tile;
  }

  function renderCardGroups(cardList) {
    const fragment = document.createDocumentFragment();
    tileById.clear();

    for (const regionGroup of groupCards(cardList)) {
      const regionSection = createElement("section", {
        className: "region-group",
        attrs: { "aria-labelledby": `region-${cssEscape(regionGroup.region)}` },
      });
      regionSection.append(
        createElement("h2", {
          className: "region-heading",
          text: `${regionGroup.region} ${formatNumber(regionGroup.count)}枚`,
          attrs: { id: `region-${regionGroup.region}` },
        }),
      );

      for (const setGroup of regionGroup.sets) {
        const setSection = createElement("section", { className: "set-group" });
        const heading = createElement("h3", { className: "set-heading" });
        heading.append(
          createElement("span", { text: setGroup.set || "セット未設定" }),
          createElement("span", { className: "set-count", text: `${formatNumber(setGroup.cards.length)}枚` }),
        );

        const grid = createElement("div", { className: "card-grid" });
        for (const card of setGroup.cards) {
          grid.append(buildTile(card));
        }
        setSection.append(heading, grid);
        regionSection.append(setSection);
      }

      fragment.append(regionSection);
    }

    els.grid.replaceChildren(fragment);
  }

  function renderFlatCardGrid(cardList) {
    tileById.clear();
    const grid = createElement("div", { className: "card-grid card-grid--flat" });
    for (const card of cardList) {
      grid.append(buildTile(card));
    }
    els.grid.replaceChildren(grid);
  }

  function renderCardResults(cardList) {
    if (state.sortMode === defaultSortMode) {
      renderCardGroups(cardList);
      return;
    }
    renderFlatCardGrid(cardList);
  }

  function applyFilters({ updateUrl = false } = {}) {
    state.visibleCards = sortCardsByMode(filterCards(cards, state), state.sortMode);
    renderCardResults(state.visibleCards);
    updateFilterControls();
    els.resultCount.textContent = `表示中 ${formatNumber(state.visibleCards.length)} / 全 ${formatNumber(totalCount)} 枚`;
    els.emptyState.hidden = state.visibleCards.length !== 0;

    if (state.activeCardId) {
      updateModalNavigation(cardById.get(state.activeCardId));
    }
    if (updateUrl) {
      writeFiltersToUrl();
    }
  }

  function readFiltersFromUrl() {
    const params = new URLSearchParams(location.search);
    const readSet = (name, target, allowed) => {
      for (const value of (params.get(name) || "").split(",").filter(Boolean)) {
        if (!allowed || allowed.has(value)) {
          target.add(value);
        }
      }
    };

    readSet("region", state.selectedRegions, new Set(regionDefinitions.map((item) => item.key)));
    readSet("kind", state.selectedKinds, new Set(kindDefinitions.map((item) => item.key)));
    readSet("type", state.selectedTypes, new Set(typeDefinitions.filter((item) => item.pokemon).map((item) => item.key)));
    readSet("rarity", state.selectedRarities, new Set(rarityDefinitions.map((item) => item.key)));
    readSet("edition", state.selectedEditions, new Set(editionDefinitions.map((item) => item.key)));

    const knownSets = new Set(cards.map((card) => card.set));
    const set = params.get("set") || "";
    state.selectedSet = knownSets.has(set) ? set : "";
    state.psaOnly = params.get("psa") === "1";
    state.favoriteOnly = params.get("fav") === "1";
    state.query = params.get("q") || "";
    const sort = params.get("sort") || defaultSortMode;
    state.sortMode = sortOptionByKey.has(sort) ? sort : defaultSortMode;
    state.advancedFiltersOpen = hasAdvancedFiltersActive();
    setSearchInputs(state.query);
  }

  function writeFiltersToUrl() {
    const url = new URL(location.href);
    const params = url.searchParams;
    const writeSet = (name, values) => {
      const text = [...values].join(",");
      if (text) {
        params.set(name, text);
      } else {
        params.delete(name);
      }
    };

    writeSet("region", state.selectedRegions);
    writeSet("kind", state.selectedKinds);
    writeSet("type", state.selectedTypes);
    writeSet("rarity", state.selectedRarities);
    writeSet("edition", state.selectedEditions);

    if (state.selectedSet) {
      params.set("set", state.selectedSet);
    } else {
      params.delete("set");
    }
    if (state.psaOnly) {
      params.set("psa", "1");
    } else {
      params.delete("psa");
    }
    if (state.favoriteOnly) {
      params.set("fav", "1");
    } else {
      params.delete("fav");
    }
    if (state.query) {
      params.set("q", state.query);
    } else {
      params.delete("q");
    }
    if (state.sortMode && state.sortMode !== defaultSortMode) {
      params.set("sort", state.sortMode);
    } else {
      params.delete("sort");
    }
    updateHistory("replaceState", url);
  }

  function resetFilters({ updateUrl = true } = {}) {
    state.selectedRegions.clear();
    state.selectedSet = "";
    state.selectedKinds.clear();
    state.selectedTypes.clear();
    state.selectedRarities.clear();
    state.selectedEditions.clear();
    state.psaOnly = false;
    state.favoriteOnly = false;
    state.query = "";
    state.sortMode = defaultSortMode;
    state.advancedFiltersOpen = false;
    setSearchInputs("");
    applyFilters({ updateUrl });
  }

  function resetToHome() {
    if (els.modal.open) {
      closeModal({ updateHash: false, restoreFocus: false });
    }
    state.activeCardId = null;
    state.lastFocusedTile = null;
    resetFilters({ updateUrl: false });
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    updateHistory("replaceState", url);
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function submitSearchInput(input) {
    state.query = String(input?.value || "").trim();
    setSearchInputs(state.query);
    applyFilters({ updateUrl: true });
    input?.blur?.();
    updateQuickSearchAvoidance();
  }

  function handleSearchKeydown(event) {
    if (event.key !== "Enter" || event.isComposing || event.keyCode === 229) {
      return;
    }
    event.preventDefault();
    submitSearchInput(event.target);
  }

  function debounce(callback, delay) {
    let timer = 0;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };
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
    if (rarityInfo.key === "★") {
      return "rare";
    }
    if (rarityInfo.key === "◆") {
      return "uncommon";
    }
    if (rarityInfo.key === "●") {
      return "common";
    }
    return "none";
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
      document.createTextNode(rarityInfo.name),
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

  function renderMarketLinks(card) {
    const yahooQuery = encodeURIComponent(`旧裏 ${card.name_ja}`);
    const marketQuery = encodeURIComponent(`${card.name_ja} 旧裏`);
    const enName = String(card.name_en || "").replace(/[♂♀]/g, "").trim() || card.name_ja;
    const ebayQuery = encodeURIComponent(`${enName} japanese pokemon old back`);
    const googleQuery = encodeURIComponent(`ポケカ 旧裏 ${card.name_ja} 相場`);
    els.marketLinks.replaceChildren(
      createMarketLink("Yahoo!フリマ", `https://paypayfleamarket.yahoo.co.jp/search/${yahooQuery}`),
      createMarketLink("メルカリ", `https://jp.mercari.com/search?keyword=${marketQuery}&category_id=1289&status=on_sale`),
      createMarketLink("magi", `https://magi.camp/items/search?forms_search_items%5Bkeyword%5D=${marketQuery}`),
      createMarketLink("スニダン", `https://snkrdunk.com/search?keywords=${marketQuery}&rootCategoryId=6`),
      createMarketLink("eBay", `https://www.ebay.com/sch/i.html?_nkw=${ebayQuery}&_sacat=183454`),
      createMarketLink("Google相場検索", `https://www.google.com/search?q=${googleQuery}`),
    );
  }

  function hideQuoteChart() {
    if (els.quoteChart) {
      els.quoteChart.replaceChildren();
    }
    if (els.quoteChartWrap) {
      els.quoteChartWrap.hidden = true;
    }
  }

  function setQuoteChartTabState(activeRange) {
    if (!els.quoteChartTabs) {
      return;
    }
    for (const button of els.quoteChartTabs.querySelectorAll("[data-chart-range]")) {
      const selected = button.getAttribute("data-chart-range") === activeRange;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
  }

  function appendSvgText(svg, attrs, text) {
    const label = createSvgElement("text", attrs);
    label.textContent = text;
    svg.append(label);
    return label;
  }

  function buildQuoteChartLegend() {
    const legend = createElement("div", { className: "quote-chart-legend", attrs: { "aria-hidden": "true" } });
    legend.append(
      createElement("span", { className: "quote-chart-legend-item quote-chart-legend-item--sell", text: "販売" }),
      createElement("span", { className: "quote-chart-legend-item quote-chart-legend-item--buy", text: "買取" }),
    );
    return legend;
  }

  function buildQuoteChartSvg(model, card) {
    const { layout, latest } = model;
    const svg = createSvgElement("svg", {
      class: `quote-chart-svg${prefersReducedMotion() ? "" : " quote-chart-svg--motion"}`,
      viewBox: `0 0 ${layout.width} ${layout.height}`,
      role: "img",
      "aria-label": `${card.name_ja}の売買相場推移`,
      preserveAspectRatio: "none",
    });
    const title = createSvgElement("title");
    title.textContent = `${card.name_ja}の売買相場推移`;
    svg.append(title);

    const baselineY = layout.height - layout.bottom;
    const plotRight = layout.width - layout.right;
    for (const tick of model.yTicks) {
      svg.append(createSvgElement("line", {
        class: "quote-chart-grid",
        x1: layout.left,
        y1: roundSvgNumber(tick.y),
        x2: plotRight,
        y2: roundSvgNumber(tick.y),
      }));
      appendSvgText(svg, {
        class: "quote-chart-label quote-chart-label--price",
        x: 6,
        y: roundSvgNumber(tick.y + 3),
      }, formatYen(tick.value));
    }

    svg.append(createSvgElement("line", {
      class: "quote-chart-axis",
      x1: layout.left,
      y1: baselineY,
      x2: plotRight,
      y2: baselineY,
    }));
    if (model.points.length > 1) {
      svg.append(createSvgElement("path", {
        class: "quote-chart-area quote-chart-area--sell",
        d: model.sellAreaPath,
      }));
      svg.append(createSvgElement("path", {
        class: "quote-chart-line quote-chart-line--sell",
        d: model.sellPath,
      }));
    }

    const firstPoint = model.points[0];
    const lastPoint = model.points.at(-1);
    appendSvgText(svg, {
      class: "quote-chart-label quote-chart-label--date",
      x: roundSvgNumber(firstPoint.x),
      y: layout.height - 15,
      "text-anchor": model.points.length === 1 ? "middle" : "start",
    }, formatChartDate(firstPoint.date));
    if (model.points.length > 1) {
      appendSvgText(svg, {
        class: "quote-chart-label quote-chart-label--date",
        x: roundSvgNumber(lastPoint.x),
        y: layout.height - 15,
        "text-anchor": "end",
      }, formatChartDate(lastPoint.date));
    }

    svg.append(createSvgElement("circle", {
      class: "quote-chart-dot quote-chart-dot--sell",
      cx: roundSvgNumber(latest.x),
      cy: roundSvgNumber(latest.ySell),
      r: 4,
    }));

    svg.append(createSvgElement("circle", {
      class: "quote-chart-selected",
      cx: roundSvgNumber(latest.x),
      cy: roundSvgNumber(latest.ySell),
      r: 7,
    }));

    model.points.forEach((point, index) => {
      const hit = createSvgElement("circle", {
        class: "quote-chart-hit",
        cx: roundSvgNumber(point.x),
        cy: roundSvgNumber(point.ySell),
        r: 15,
        tabindex: "0",
        role: "button",
        "aria-label": getQuoteChartPointLabel(point),
        "aria-pressed": String(point === latest),
        "data-chart-point-index": String(index),
      });
      const pointTitle = createSvgElement("title");
      pointTitle.textContent = getQuoteChartPointLabel(point);
      hit.append(pointTitle);
      svg.append(hit);
    });

    return svg;
  }

  function renderQuoteChartReadout(point) {
    return createElement("p", {
      className: "quote-chart-readout",
      text: point ? getQuoteChartPointLabel(point) : "チャート上の点をタップすると、その日の相場を表示します",
    });
  }

  function selectQuoteChartPoint(point) {
    if (!els.quoteChart || !point) {
      return;
    }
    const selected = els.quoteChart.querySelector(".quote-chart-selected");
    if (selected) {
      selected.setAttribute("cx", roundSvgNumber(point.x));
      selected.setAttribute("cy", roundSvgNumber(point.ySell));
    }
    for (const hit of els.quoteChart.querySelectorAll(".quote-chart-hit")) {
      hit.setAttribute("aria-pressed", "false");
    }
    const activeHit = els.quoteChart.querySelector(`.quote-chart-hit[data-chart-point-index="${point.index}"]`);
    if (activeHit) {
      activeHit.setAttribute("aria-pressed", "true");
    }
    const readout = els.quoteChart.querySelector(".quote-chart-readout");
    if (readout) {
      readout.textContent = getQuoteChartPointLabel(point);
    }
  }

  function renderQuoteChart(card, editionKey = "") {
    if (!els.quoteChartWrap || !els.quoteChart) {
      return;
    }

    const history = getPriceHistoryPoints(card, normalizeModalEdition(card, editionKey || state.activeEditionKey));
    els.quoteChart.replaceChildren();
    if (!history.length) {
      hideQuoteChart();
      return;
    }

    const model = buildQuoteChartModel(history, state.quoteChartRange);
    if (model.mode === "empty") {
      hideQuoteChart();
      return;
    }

    state.quoteChartRange = model.rangeKey;
    setQuoteChartTabState(model.rangeKey);
    els.quoteChartWrap.hidden = false;
    const statusText = history.length === 1 ? "推移は記録中（日次で増えます）" : "この期間の推移は1点のみです";
    if (model.mode === "single") {
      els.quoteChart.append(createElement("p", { className: "quote-chart-status", text: statusText }));
    }
    els.quoteChart.append(buildQuoteChartSvg(model, card), renderQuoteChartReadout(model.latest));
  }

  function handleQuoteChartPointSelect(event) {
    const target = event.target.closest?.(".quote-chart-hit");
    if (!target || !els.quoteChart?.contains(target)) {
      return;
    }
    const card = cardById.get(state.activeCardId);
    if (!card) {
      return;
    }
    const history = getPriceHistoryPoints(card, normalizeModalEdition(card, state.activeEditionKey));
    const model = buildQuoteChartModel(history, state.quoteChartRange);
    const point = model.points[Number(target.getAttribute("data-chart-point-index"))];
    if (!point) {
      return;
    }
    event.preventDefault();
    selectQuoteChartPoint(point);
  }

  function handleQuoteChartPointKeydown(event) {
    if (!["Enter", " "].includes(event.key)) {
      return;
    }
    handleQuoteChartPointSelect(event);
  }

  function handleQuoteChartTabClick(event) {
    const button = event.target.closest?.("[data-chart-range]");
    if (!button || !quoteChartRangeByKey.has(button.getAttribute("data-chart-range"))) {
      return;
    }
    state.quoteChartRange = button.getAttribute("data-chart-range");
    const card = cardById.get(state.activeCardId);
    if (card) {
      renderQuoteChart(card, state.activeEditionKey);
    }
  }

  function handleQuoteChartTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !els.quoteChartTabs) {
      return;
    }
    const tabs = [...els.quoteChartTabs.querySelectorAll("[data-chart-range]")];
    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    if (currentIndex < 0) {
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  }

  function buildQuoteCard(label, quote, modifier) {
    const card = createElement("div", { className: `quote-card quote-card--${modifier}` });
    if (!quote) {
      card.append(
        createElement("span", { className: "quote-label", text: label }),
        createElement("span", { className: "quote-amount quote-amount--empty", text: "未取得" }),
        createElement("span", {
          className: "quote-note",
          text: "次回の価格更新で版別検索を試します",
        }),
      );
      return card;
    }
    card.append(
      createElement("span", { className: "quote-label", text: label }),
      createElement("span", { className: "quote-amount", text: formatYen(quote.sell) }),
      createElement("span", {
        className: "quote-note",
        text: `販売目安 / 複数出品 ${formatNumber(quote.n)} 件の中央値ベース`,
      }),
      createElement("span", {
        className: "quote-note",
        text: `買取目安 ${formatYen(quote.buy)} / 状態により変動します`,
      }),
    );
    return card;
  }

  function getLatestQuoteUpdated(items) {
    return items
      .map((item) => item.quote?.updated)
      .filter(Boolean)
      .sort()
      .at(-1) || "";
  }

  function renderEditionSwitch(card) {
    if (!els.modalEditionSwitch) {
      return;
    }
    const options = getEditionOptions(card);
    if (options.length <= 1) {
      els.modalEditionSwitch.hidden = true;
      els.modalEditionSwitch.replaceChildren();
      return;
    }
    const activeEdition = normalizeModalEdition(card, state.activeEditionKey);
    els.modalEditionSwitch.hidden = false;
    els.modalEditionSwitch.replaceChildren();
    for (const option of options) {
      const button = createElement("button", {
        className: `edition-switch-button edition-switch-button--${option.key}`,
        text: option.shortLabel,
        attrs: {
          type: "button",
          "data-modal-edition": option.key,
          "aria-pressed": String(option.key === activeEdition),
        },
      });
      button.addEventListener("click", () => {
        state.activeEditionKey = option.key;
        renderEditionDependentSections(card);
      });
      els.modalEditionSwitch.append(button);
    }
  }

  function renderQuote(card, editionKey = "") {
    if (!els.quoteSection || !els.quoteBody) {
      return;
    }

    const normalizedEdition = normalizeModalEdition(card, editionKey || state.activeEditionKey);
    const editionQuotes = hasFirstEditionVariant(card)
      ? getEditionQuotes(card).filter((item) => item.key === normalizedEdition)
      : getEditionQuotes(card);
    els.quoteBody.replaceChildren();
    if (!editionQuotes.some((item) => item.quote)) {
      els.quoteSection.hidden = true;
      hideQuoteChart();
      return;
    }

    els.quoteSection.hidden = false;
    const metrics = createElement("div", {
      className: "quote-metrics",
    });
    for (const item of editionQuotes) {
      metrics.append(buildQuoteCard(item.label, item.quote, item.modifier));
    }
    const updated = getLatestQuoteUpdated(editionQuotes);
    els.quoteBody.append(
      metrics,
      createElement("p", {
        className: "quote-source",
        text: `最終更新 ${formatDate(updated)} / 価格参考: magi等の出品相場 / 初版はマークなし、通常版はマークありとして分けています`,
      }),
    );
    renderQuoteChart(card, normalizedEdition);
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
      createElement("span", { className: "psa-grade-percent", text: `${formatPercent(percent)}%` }),
    );
    row.querySelector(".psa-grade-track").append(fill);
    return row;
  }

  function renderPSA(card, editionKey = "") {
    if (!els.psaSection || !els.psaBody) {
      return;
    }

    const normalizedEdition = normalizeModalEdition(card, editionKey || state.activeEditionKey);
    const psa = getPSAEntry(card, normalizedEdition);
    els.psaSection.hidden = false;
    els.psaBody.replaceChildren();
    if (!psa) {
      els.psaBody.append(createElement("p", {
        className: "psa-empty",
        text: "PSA状態は未収集です",
      }));
      return;
    }
    if (psa.status === "spec_unmatched") {
      const searchQueries = Array.isArray(psa.spec_search_queries)
        ? psa.spec_search_queries.filter(Boolean)
        : [];
      const firstQuery = searchQueries.find((query) => /vending|pokemon japanese/i.test(query)) || searchQueries[0] || "";
      const source = createElement("p", { className: "psa-source" });
      source.append(document.createTextNode("全カード照合対象です。"));
      if (firstQuery) {
        const link = createElement("a", {
          text: "PSA公式で候補検索",
          attrs: {
            href: `https://www.psacard.com/search?q=${encodeURIComponent(firstQuery)}`,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        });
        source.append(
          document.createTextNode("候補検索: "),
          link,
          document.createTextNode(`（${firstQuery}）`),
        );
      } else {
        source.append(document.createTextNode("PSA側の該当spec IDが見つかり次第、鑑定数を表示します。"));
      }
      els.psaBody.append(
        createElement("p", {
          className: "psa-empty",
          text: "PSA spec ID未照合（鑑定数0件とは未判定）",
        }),
        source,
      );
      return;
    }
    if (psa.status === "pending") {
      els.psaBody.append(createElement("p", {
        className: "psa-empty",
        text: `PSA spec ID照合済み（${psa.spec_id || "-"}）・鑑定数は次回更新待ちです`,
      }));
      return;
    }
    if (psa.status === "no_population") {
      els.psaBody.append(createElement("p", {
        className: "psa-empty",
        text: "PSA APIで母集団データが返っていません（0件とは未判定）",
      }));
      return;
    }

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
      }),
    );
    summary.querySelector(".psa-metric--gem .psa-metric-value").textContent = `${formatPercent(psa.gem_rate)}%`;
    summary.querySelector(".psa-metric:not(.psa-metric--gem) .psa-metric-value").textContent = `${formatNumber(total)}枚`;

    const list = createElement("div", { className: "psa-grade-list" });
    for (let grade = 10; grade >= 1; grade -= 1) {
      list.append(buildPSAGradeRow(grade, grades[`g${grade}`], total));
    }

    const source = createElement("p", { className: "psa-source" });
    const editionLabel = getEditionOptions(card).find((item) => item.key === normalizedEdition)?.label || "";
    source.append(
      document.createTextNode(`PSA公式データ${editionLabel ? `（${editionLabel}）` : ""} / Spec ID ${psa.spec_id || "-"} / 最終更新 ${formatDate(psa.updated)} / `),
      createElement("a", {
        text: "psacard.com",
        attrs: {
          href: "https://www.psacard.com/pop",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    );

    els.psaBody.append(summary, list, source);
  }

  function buildEvolutionLine(card) {
    if (getCardKind(card) !== "ポケモン" || !card.stage) {
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

  function renderModalDetails(card, editionKey = "") {
    const typeInfo = getTypeInfo(card);
    const editionInfo = getEditionInfo(card, editionKey || state.activeEditionKey);
    els.modalDetails.replaceChildren();

    const hp = createElement("span", { className: "hp-strong", text: getHpLabel(card) });
    hp.style.setProperty("--type-color", typeInfo.color);
    appendDetail("HP", hp);

    const typeValue = createElement("span", { className: "summary-chip" });
    typeValue.style.setProperty("--type-color", typeInfo.color);
    typeValue.append(createElement("span", { className: "type-dot", attrs: { "aria-hidden": "true" } }), document.createTextNode(typeInfo.fullLabel));
    appendDetail("属性", typeValue);

    appendDetail("カード番号", card.card_number || "-");
    appendDetail("セット名", card.set || "-");
    appendDetail("版区分", editionInfo.detail);
    appendDetail("地方", card.region || "-");
    appendDetail("イラストレーター", card.illustrator || "-");
  }

  function renderModalImage(card, editionKey = "") {
    const normalizedEdition = normalizeModalEdition(card, editionKey || state.activeEditionKey);
    const imageUrl = getCardImageUrl(card, normalizedEdition);
    const caption = [card.region, card.set].filter(Boolean).join(" / ") || "-";
    const editionInfo = getEditionInfo(card, normalizedEdition);
    els.modalFallback.textContent = "";
    clearImageFallback(els.modalThumb);
    els.modalImage.onerror = () => markImageFallback(els.modalThumb, `${getCardNumberLabel(card)}\n${card.name_ja}\n画像なし`);
    els.modalImage.alt = `${card.name_ja} ${caption} ${editionInfo.label}のカード画像`;
    if (imageUrl) {
      els.modalImage.src = imageUrl;
    } else {
      els.modalImage.removeAttribute("src");
      markImageFallback(els.modalThumb, `${getCardNumberLabel(card)}\n${card.name_ja}\n画像なし`);
    }
  }

  function renderEditionDependentSections(card) {
    const editionKey = normalizeModalEdition(card, state.activeEditionKey);
    state.activeEditionKey = editionKey;
    renderModalImage(card, editionKey);
    renderEditionSwitch(card);
    renderModalDetails(card, editionKey);
    renderQuote(card, editionKey);
    renderPSA(card, editionKey);
  }

  function renderModal(card) {
    const caption = [card.region, card.set].filter(Boolean).join(" / ") || "-";
    state.activeCardId = card.id;
    state.activeEditionKey = getDefaultModalEdition(card);

    setTypeStyle(els.modalPanel, card);
    setTypeStyle(els.modal, card);
    setTypeStyle(els.modalHeader, card);

    els.modalNo.textContent = getCardNumberLabel(card);
    els.modalTitle.textContent = card.name_ja;
    els.modalCaption.textContent = caption;
    els.modalChips.replaceChildren();
    els.modalChips.hidden = true;
    renderModalImage(card, state.activeEditionKey);
    renderEditionSwitch(card);
    renderModalDetails(card, state.activeEditionKey);
    renderMarketLinks(card);
    renderQuote(card, state.activeEditionKey);
    renderPSA(card, state.activeEditionKey);
    updateModalNavigation(card);
    els.sourceLink.href = card.source_url || "#";
  }

  function updateModalNavigation(card) {
    if (!card) {
      return;
    }
    const navCards = state.visibleCards.some((visibleCard) => visibleCard.id === card.id) ? state.visibleCards : cards;
    const index = navCards.findIndex((visibleCard) => visibleCard.id === card.id);
    els.prevCard.disabled = index <= 0;
    els.nextCard.disabled = index < 0 || index >= navCards.length - 1;
    els.prevCard.dataset.targetId = index > 0 ? navCards[index - 1].id : "";
    els.nextCard.dataset.targetId = index >= 0 && index < navCards.length - 1 ? navCards[index + 1].id : "";
  }

  function makeUrlWithHash(hash) {
    const url = new URL(location.href);
    url.hash = hash;
    return url;
  }

  function updateHistory(method, url) {
    try {
      history[method](history.state, "", url);
    } catch (error) {
      if (url.hash && location.hash !== url.hash) {
        location.hash = url.hash;
      }
    }
  }

  function openModal(id, { updateHash = true, push = false, focusSource = null } = {}) {
    const card = cardById.get(id);
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
      const url = makeUrlWithHash(getHashForCard(card));
      const method = push ? "pushState" : "replaceState";
      if (location.hash !== url.hash) {
        updateHistory(method, url);
      }
    }
  }

  function closeModal({ updateHash = true, restoreFocus = true } = {}) {
    if (!els.modal.open) {
      return;
    }
    if (typeof els.modal.close === "function") {
      els.modal.close();
    } else {
      els.modal.removeAttribute("open");
    }
    document.body.classList.remove("scroll-locked");
    state.activeCardId = null;

    if (updateHash && getIdFromHash(location.hash)) {
      const url = makeUrlWithHash("");
      updateHistory("pushState", url);
    }
    if (restoreFocus && state.lastFocusedTile?.isConnected) {
      state.lastFocusedTile.focus();
    }
  }

  function navigateModal(direction) {
    if (!state.activeCardId) {
      return;
    }
    const card = cardById.get(state.activeCardId);
    const navCards = state.visibleCards.some((visibleCard) => visibleCard.id === state.activeCardId) ? state.visibleCards : cards;
    const index = navCards.findIndex((visibleCard) => visibleCard.id === card?.id);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= navCards.length) {
      return;
    }
    openModal(navCards[nextIndex].id, { updateHash: true, push: true });
  }

  function openFromHash() {
    const id = getIdFromHash(location.hash);
    if (!id) {
      if (els.modal.open) {
        closeModal({ updateHash: false, restoreFocus: false });
      }
      return;
    }
    openModal(id, { updateHash: false });
  }

  function bindEvents() {
    const applySearchInput = debounce(() => {
      state.query = els.searchInput.value.trim();
      applyFilters({ updateUrl: true });
    }, 200);
    const handleSearchInput = (event) => {
      setSearchInputs(event.target.value);
      applySearchInput();
    };

    els.searchInput.addEventListener("input", handleSearchInput);
    els.searchInput.addEventListener("keydown", handleSearchKeydown);
    els.quickSearchInput?.addEventListener("input", handleSearchInput);
    els.quickSearchInput?.addEventListener("keydown", handleSearchKeydown);
    els.quickSearchClear?.addEventListener("click", () => {
      state.query = "";
      setSearchInputs("");
      applyFilters({ updateUrl: true });
      els.quickSearchInput?.focus();
    });
    els.setFilter.addEventListener("change", (event) => {
      state.selectedSet = event.target.value;
      applyFilters({ updateUrl: true });
    });
    els.psaOnly.addEventListener("change", (event) => {
      state.psaOnly = event.target.checked;
      applyFilters({ updateUrl: true });
    });
    els.favoritesOnly?.addEventListener("change", (event) => {
      state.favoriteOnly = event.target.checked;
      applyFilters({ updateUrl: true });
    });
    els.sortButton?.addEventListener("click", (event) => {
      event.stopPropagation();
      setSortMenuOpen(els.sortMenu?.hidden !== false);
    });
    els.sortMenu?.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-sort-mode]");
      if (!button) {
        return;
      }
      selectSortMode(button.getAttribute("data-sort-mode"));
    });
    els.advancedFilterToggle?.addEventListener("click", () => {
      setAdvancedFiltersOpen(!state.advancedFiltersOpen);
    });
    els.homeResetButton?.addEventListener("click", resetToHome);
    els.resetButton.addEventListener("click", resetFilters);
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
    els.quoteChartTabs?.addEventListener("click", handleQuoteChartTabClick);
    els.quoteChartTabs?.addEventListener("keydown", handleQuoteChartTabKeydown);
    els.quoteChart?.addEventListener("click", handleQuoteChartPointSelect);
    els.quoteChart?.addEventListener("keydown", handleQuoteChartPointKeydown);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setSortMenuOpen(false);
      }
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
    document.addEventListener("click", (event) => {
      if (els.sortMenu?.hidden !== false) {
        return;
      }
      if (event.target?.closest?.(".sort-control")) {
        return;
      }
      setSortMenuOpen(false);
    });
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener("popstate", openFromHash);
    window.addEventListener("resize", updateQuickSearchAvoidance);
    window.visualViewport?.addEventListener("resize", updateQuickSearchAvoidance);
    window.visualViewport?.addEventListener("scroll", updateQuickSearchAvoidance);
    els.searchInput.addEventListener("focus", updateQuickSearchAvoidance);
    els.quickSearchInput?.addEventListener("focus", updateQuickSearchAvoidance);
  }

  function init() {
    renderFilters();
    readFiltersFromUrl();
    bindEvents();
    updateQuickSearchAvoidance();
    applyFilters();
    openFromHash();
  }

  init();
})();
