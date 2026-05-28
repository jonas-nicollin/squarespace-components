(function() {
    "use strict";
    // ── Rétrocompatibilité ─────────────────────────────────────────────
    const ALL_CONFIGS = Array.isArray(window.RELATED_BLOCK_CONFIGS) ? window.RELATED_BLOCK_CONFIGS : Array.isArray(window.COLLECTION_RELATED_BLOCK_CONFIGS) ? window.COLLECTION_RELATED_BLOCK_CONFIGS : [];
    if (!ALL_CONFIGS.length) return;
    // Extraire l'entrée _shared (doit être en première position)
    const SHARED_CONFIG = ALL_CONFIGS[0]?._shared === true ? ALL_CONFIGS[0] : null;
    const CONFIGS = SHARED_CONFIG ? ALL_CONFIGS.slice(1) : ALL_CONFIGS;
    if (!CONFIGS.length && !SHARED_CONFIG) return;
    // Mode développement : désactive tous les caches quand _shared.devMode === true
    const DEV_MODE = SHARED_CONFIG?.devMode === true;
    function addClasses(el, classes) {
        String(classes || "").split(/\s+/).map(s => s.trim()).filter(Boolean).forEach(cls => el.classList.add(cls));
        return el;
    }
    // ── Constantes ────────────────────────────────────────────────────
    const DEFAULT_JSON_FORMAT_SUFFIX = "?format=json";
    const DEFAULT_SRCSET_WIDTHS = [ 100, 300, 500, 750, 1e3, 1500, 2500 ];
    const DEFAULT_IMAGE_SIZES = "(max-width: 768px) 100vw, 50vw";
    const BODY_CLASS_PREFIX = "has-related-block--";
    // Déduplication des fetches en vol :
    // si deux blocs demandent la même collection simultanément,
    // le second attend la promesse du premier au lieu de relancer un fetch.
    // ── Fuseau horaire Squarespace ────────────────────────────────────
    const SITE_TZ = function() {
        try {
            const ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
            return ctx && ctx.websiteTimeZone ? ctx.websiteTimeZone : null;
        } catch (_) {
            return null;
        }
    }();
    // ════════════════════════════════════════════════════════════════
    // DATES ISO
    // ════════════════════════════════════════════════════════════════
    /**
   * Parse une chaîne ISO partielle : YYYY-MM-DD, YYYY-MM-DDThh:mm, etc.
   * Retourne { year, month (0-based), day, hour, min, ts } ou null.
   */
    function parseISO(str) {
        const s = String(str || "").trim();
        // Ignorer les intervalles ici (gérés dans formatISOTag)
        if (s.indexOf("/") !== -1) return null;
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
        if (!m) return null;
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const day = parseInt(m[3], 10);
        const hour = m[4] != null ? parseInt(m[4], 10) : null;
        const min = m[5] != null ? parseInt(m[5], 10) : null;
        return {
            year: year,
            month: month,
            day: day,
            hour: hour,
            min: min,
            ts: new Date(year, month, day, hour ?? 0, min ?? 0).getTime()
        };
    }
    function capitalize(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }
    /**
   * Formate une valeur de tag ISO en texte lisible.
   * Supporte les intervalles : 2026-09-14/2026-09-22 → '14–22 septembre 2026'
   *
   * @param {string} str         - valeur brute du tag
   * @param {string|object} fmt  - 'datetime'|'date'|'day'|'short'|'numeric'|'time'|objet Intl
   * @param {string} locale      - locale BCP 47 (ex: 'fr-CH')
   */
    function formatISOTag(str, fmt, locale) {
        const s = String(str || "").trim();
        const loc = locale || document.documentElement.lang || "fr-CH";
        const tzOpt = SITE_TZ ? {
            timeZone: SITE_TZ
        } : {};
        // Intervalle de dates
        if (s.indexOf("/") !== -1) {
            const parts = s.split("/");
            const d1 = parseISO(parts[0]);
            const d2 = parseISO(parts[1]);
            if (d1 && d2) {
                try {
                    const dt1 = new Date(d1.year, d1.month, d1.day);
                    const dt2 = new Date(d2.year, d2.month, d2.day);
                    if (d1.month === d2.month && d1.year === d2.year) {
                        const mth = dt1.toLocaleDateString(loc, {
                            month: "long"
                        });
                        return `${d1.day}\u2013${d2.day}\u00a0${mth}\u00a0${d1.year}`;
                    }
                    return dt1.toLocaleDateString(loc, {
                        day: "numeric",
                        month: "long"
                    }) + " – " + dt2.toLocaleDateString(loc, {
                        day: "numeric",
                        month: "long",
                        year: "numeric"
                    });
                } catch (_) {
                    return s;
                }
            }
            return s;
        }
        const d = parseISO(s);
        if (!d) return s;
        const dt = new Date(d.year, d.month, d.day, d.hour ?? 0, d.min ?? 0);
        try {
            // Objet Intl custom
            if (fmt && typeof fmt === "object") {
                return capitalize(dt.toLocaleDateString(loc, Object.assign({}, tzOpt, fmt)));
            }
            if (fmt === "time") {
                if (d.hour === null) return "";
                return dt.toLocaleTimeString(loc, Object.assign({
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }, tzOpt));
            }
            if (fmt === "numeric") {
                return dt.toLocaleDateString(loc, Object.assign({
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric"
                }, tzOpt));
            }
            if (fmt === "short") {
                return capitalize(dt.toLocaleDateString(loc, Object.assign({
                    weekday: "short",
                    day: "numeric",
                    month: "short"
                }, tzOpt)));
            }
            // 'short-time' → Sam. 19 sept., 15h00 (heure omise si absente du tag)
            if (fmt === "short-time") {
                const shortDay = capitalize(dt.toLocaleDateString(loc, Object.assign({
                    weekday: "short",
                    day: "numeric",
                    month: "short"
                }, tzOpt)));
                if (d.hour !== null) {
                    const timeStr = dt.toLocaleTimeString(loc, Object.assign({
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                    }, tzOpt));
                    return `${shortDay}, ${timeStr}`;
                }
                return shortDay;
            }
            if (fmt === "day") {
                return capitalize(dt.toLocaleDateString(loc, Object.assign({
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                }, tzOpt)));
            }
            if (fmt === "date") {
                return capitalize(dt.toLocaleDateString(loc, Object.assign({
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }, tzOpt)));
            }
            // 'datetime' (défaut) : inclure l'heure si présente
            const dayStr = capitalize(dt.toLocaleDateString(loc, Object.assign({
                weekday: "long",
                day: "numeric",
                month: "long"
            }, tzOpt)));
            if (d.hour !== null) {
                const timeStr = dt.toLocaleTimeString(loc, Object.assign({
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                }, tzOpt));
                return `${dayStr}, ${timeStr}`;
            }
            return dayStr;
        } catch (_) {
            return s;
        }
    }
    /**
   * Retourne le timestamp de tri à partir d'une valeur de tag ISO.
   * Utilisé pour le tri { type: 'tagPrefix', prefix: 'Date' }.
   */
    function getISOTimestamp(str) {
        const s = String(str || "").trim();
        // Intervalle : on trie par la date de début
        const raw = s.indexOf("/") !== -1 ? s.split("/")[0] : s;
        const d = parseISO(raw);
        return d ? d.ts : Infinity;
    }
    // ════════════════════════════════════════════════════════════════
    // UTILITAIRES TEXTE
    // ════════════════════════════════════════════════════════════════
    function normalize(str) {
        return String(str || "").replace(/\u00A0/g, " ").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2019']/g, "'").replace(/&/g, "and").replace(/\s+/g, " ").trim();
    }
    function uniq(arr) {
        return Array.from(new Set(arr));
    }
    function decodeHtmlEntities(str) {
        const txt = document.createElement("textarea");
        txt.innerHTML = String(str || "");
        return txt.value;
    }
    function cleanText(str) {
        return decodeHtmlEntities(str).replace(/&nbsp;/gi, " ").replace(/&#160;/gi, " ").replace(/\u00A0/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    function truncateText(str, maxLength) {
        const text = cleanText(str);
        if (!text || text.length <= maxLength) return text;
        const sliced = text.slice(0, maxLength);
        const lastSpace = sliced.lastIndexOf(" ");
        return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim() + "…";
    }
    function uniqBy(arr, keyFn) {
        const seen = new Set();
        return arr.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
    // ════════════════════════════════════════════════════════════════
    // TAGS — PARSING
    // ════════════════════════════════════════════════════════════════
    function getPrefix(tag) {
        const raw = String(tag || "");
        const idx = raw.indexOf(":");
        return idx === -1 ? null : raw.slice(0, idx).trim();
    }
    function getTagValue(tag) {
        const raw = String(tag || "");
        const idx = raw.indexOf(":");
        return idx === -1 ? raw.trim() : raw.slice(idx + 1).trim();
    }
    function slugifyToken(str) {
        return String(str || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }
    function buildTagObjects(tags) {
        return (Array.isArray(tags) ? tags : []).map(tag => {
            const prefix = getPrefix(tag);
            const value = getTagValue(tag);
            return {
                raw: cleanText(tag),
                prefix: cleanText(prefix),
                prefixNorm: normalize(prefix),
                value: cleanText(value),
                valueNorm: normalize(value),
                rawNorm: normalize(tag)
            };
        }).filter(t => t.rawNorm);
    }
    function getTagValuesByPrefix(item, prefix) {
        if (!prefix) return [];
        const normalizedPrefix = normalize(String(prefix).replace(/:$/, ""));
        return (Array.isArray(item?.tags) ? item.tags : []).map(tag => {
            const raw = String(tag || "");
            const idx = raw.indexOf(":");
            if (idx === -1) return null;
            const tagPrefix = normalize(raw.slice(0, idx));
            const value = cleanText(raw.slice(idx + 1));
            return tagPrefix === normalizedPrefix ? value : null;
        }).filter(Boolean);
    }
    // ════════════════════════════════════════════════════════════════
    // BODY CLASSES
    // ════════════════════════════════════════════════════════════════
    function getBodyRelatedBlockClassName(key) {
        return BODY_CLASS_PREFIX + slugifyToken(key || "related-block");
    }
    function syncBodyRelatedBlockClasses() {
        if (!document.body) return;
        Array.from(document.body.classList).forEach(cls => {
            if (cls.indexOf(BODY_CLASS_PREFIX) === 0) document.body.classList.remove(cls);
        });
        const blocks = Array.from(document.querySelectorAll(".related-block[data-related-key]"));
        if (!blocks.length) {
            document.body.classList.remove("has-related-blocks");
            return;
        }
        document.body.classList.add("has-related-blocks");
        blocks.forEach(block => {
            const key = String(block.dataset.relatedKey || "").trim();
            if (key) document.body.classList.add(getBodyRelatedBlockClassName(key));
        });
    }
    // ════════════════════════════════════════════════════════════════
    // HELPERS ITEM
    // ════════════════════════════════════════════════════════════════
    function getComparableDisplayIndex(item) {
        const v = Number(item?.displayIndex);
        return Number.isFinite(v) ? v : null;
    }
    function getCurrentPathname() {
        return (location.pathname || "").replace(/\/+$/, "") || "/";
    }
    function getAssetUrl(item) {
        return item?.assetUrl || item?.asset?.url || null;
    }
    function getItemTimestamp(item) {
        return Number(item?.startDate || item?.publishOn || item?.addedOn || item?.updatedOn || 0);
    }
    function getItemExcerpt(item, maxLength) {
        // maxLength: nombre > 0 pour tronquer, 0 ou false pour tout afficher
        const excerptText = cleanText(item?.excerpt || "");
        if (excerptText) {
            return maxLength ? truncateText(excerptText, maxLength) : excerptText;
        }
        const bodyText = cleanText(item?.body || "");
        if (bodyText) {
            return maxLength ? truncateText(bodyText, maxLength) : bodyText;
        }
        return "";
    }
    function getItemLocationText(item) {
        if (item?.location?.addressTitle) return cleanText(item.location.addressTitle);
        if (item?.location?.addressLine1) return cleanText(item.location.addressLine1);
        return "";
    }
    /**
   * Résout la longueur max de l'extrait depuis la config.
   * display.excerptMaxLength :
   *   undefined / absent → 180 (défaut, rétrocompat)
   *   0 / false          → pas de troncature
   *   nombre > 0         → tronquer à ce nombre de caractères
   */
    function getExcerptMaxLength(CFG) {
        const val = CFG?.display?.excerptMaxLength;
        if (val === false || val === 0) return 0;
        if (typeof val === "number" && val > 0) return val;
        return 180; // défaut
    }
    function mapItemForRender(item, CFG) {
        const tagPrefixFields = Array.isArray(CFG?.display?.tagPrefixFields) ? CFG.display.tagPrefixFields : [];
        const tagPrefixValues = tagPrefixFields.map(fieldConfig => {
            const prefix = fieldConfig?.prefix || "";
            const values = getTagValuesByPrefix(item, prefix);
            if (!values.length) return null;
            const limitedValues = fieldConfig?.maxItems ? values.slice(0, Number(fieldConfig.maxItems)) : values;
            return {
                prefix: cleanText(prefix),
                prefixSlug: slugifyToken(String(prefix).replace(/:$/, "")),
                values: limitedValues,
                value: limitedValues.join(fieldConfig?.joinWith || ", "),
                label: cleanText(fieldConfig?.label || "")
            };
        }).filter(Boolean);
        return {
            title: cleanText(item.title || ""),
            urlId: item.urlId || "",
            fullUrl: item.fullUrl || "",
            assetUrl: getAssetUrl(item),
            mediaFocalPoint: item.mediaFocalPoint || null,
            categories: Array.isArray(item.categories) ? item.categories.map(c => cleanText(c)).filter(Boolean) : [],
            tags: Array.isArray(item.tags) ? item.tags.map(t => cleanText(t)).filter(Boolean) : [],
            excerpt: getItemExcerpt(item, getExcerptMaxLength(CFG)),
            locationText: getItemLocationText(item),
            displayIndex: Number(item.displayIndex || 999999),
            timestamp: getItemTimestamp(item),
            tagPrefixValues: tagPrefixValues,
            rawItem: item
        };
    }
    // ════════════════════════════════════════════════════════════════
    // RÈGLES DE MATCHING
    // ════════════════════════════════════════════════════════════════
    function itemHasCategory(item, cat) {
        return (Array.isArray(item.categories) ? item.categories : []).map(normalize).includes(normalize(cat));
    }
    function itemHasAnyCategory(item, values) {
        return Array.isArray(values) && values.length ? values.some(c => itemHasCategory(item, c)) : false;
    }
    function itemHasTag(item, tagName) {
        return (Array.isArray(item.tags) ? item.tags : []).map(normalize).includes(normalize(tagName));
    }
    function itemHasAnyExactTag(item, values) {
        return Array.isArray(values) && values.length ? values.some(t => itemHasTag(item, t)) : false;
    }
    function getTagObjects(item) {
        return buildTagObjects(item.tags || []);
    }
    function getCurrentTagObjectsByPrefixes(currentItem, prefixes) {
        const prefixSet = new Set((Array.isArray(prefixes) ? prefixes : []).map(normalize));
        return getTagObjects(currentItem).filter(t => prefixSet.has(t.prefixNorm));
    }
    function itemSharesTagPrefix(candidateItem, currentItem, prefixes) {
        const prefixSet = new Set((Array.isArray(prefixes) ? prefixes : []).map(normalize));
        if (!prefixSet.size) return false;
        const currentTags = getTagObjects(currentItem).filter(t => prefixSet.has(t.prefixNorm));
        if (!currentTags.length) return false;
        const currentSet = new Set(currentTags.map(t => t.rawNorm));
        return getTagObjects(candidateItem).some(t => currentSet.has(t.rawNorm));
    }
    function itemSharesCategory(candidateItem, currentItem) {
        const currentCategories = new Set((currentItem.categories || []).map(normalize).filter(Boolean));
        if (!currentCategories.size) return false;
        return (candidateItem.categories || []).some(c => currentCategories.has(normalize(c)));
    }
    function itemTitleMatchesCurrentTagValue(candidateItem, currentItem, prefixes) {
        const candidateTitleNorm = normalize(candidateItem.title || "");
        if (!candidateTitleNorm) return false;
        return getCurrentTagObjectsByPrefixes(currentItem, prefixes).map(t => t.valueNorm).includes(candidateTitleNorm);
    }
    function findNextCollectionItemOfCategory(items, currentItem, rule) {
        const currentIndex = getComparableDisplayIndex(currentItem);
        if (currentIndex === null) return null;
        const wantedCategories = Array.isArray(rule?.values) ? rule.values : rule?.category ? [ rule.category ] : [];
        const currentUrl = String(currentItem?.fullUrl || "").replace(/\/+$/, "") || "/";
        return (Array.isArray(items) ? items : []).filter(item => {
            if (!item) return false;
            const idx = getComparableDisplayIndex(item);
            if (idx === null || idx <= currentIndex) return false;
            if (String(item?.fullUrl || "").replace(/\/+$/, "") === currentUrl) return false;
            if (wantedCategories.length && !itemHasAnyCategory(item, wantedCategories)) return false;
            return true;
        }).sort((a, b) => getComparableDisplayIndex(a) - getComparableDisplayIndex(b))[0] || null;
    }
    function findNextCollectionItemWithTag(items, currentItem, rule) {
        const currentIndex = getComparableDisplayIndex(currentItem);
        if (currentIndex === null) return null;
        const wantedTags = Array.isArray(rule?.values) ? rule.values.map(normalize) : [];
        const currentUrl = String(currentItem?.fullUrl || "").replace(/\/+$/, "") || "/";
        return (Array.isArray(items) ? items : []).filter(item => {
            if (!item) return false;
            const idx = getComparableDisplayIndex(item);
            if (idx === null || idx <= currentIndex) return false;
            if (String(item?.fullUrl || "").replace(/\/+$/, "") === currentUrl) return false;
            if (wantedTags.length) {
                const itemTags = (Array.isArray(item.tags) ? item.tags : []).map(normalize);
                if (!wantedTags.some(t => itemTags.includes(t))) return false;
            }
            return true;
        }).sort((a, b) => getComparableDisplayIndex(a) - getComparableDisplayIndex(b))[0] || null;
    }
    /**
   * Cherche l'item dont le tag préfixé (ex. 'Numéro') a la valeur entière
   * la plus petite strictement supérieure à celle de l'item courant.
   * Filtre optionnel par catégories (rule.categories) et/ou tags exacts (rule.tags).
   *
   * Config :
   *   { type: 'nextByTagValue', prefix: 'Numéro', categories: ['Exposition'] }
   */
    function findNextByTagValue(items, currentItem, rule) {
        const prefix = String(rule?.prefix || "").replace(/:$/, "");
        if (!prefix) return null;
        const currentValues = getTagValuesByPrefix(currentItem, prefix);
        if (!currentValues.length) return null;
        const currentNum = parseFloat(currentValues[0]);
        if (!isFinite(currentNum)) return null;
        const filterCategories = Array.isArray(rule?.categories) ? rule.categories : [];
        const filterTags = Array.isArray(rule?.tags) ? rule.tags.map(normalize) : [];
        const currentUrl = String(currentItem?.fullUrl || "").replace(/\/+$/, "") || "/";
        let best = null;
        let bestNum = Infinity;
        (Array.isArray(items) ? items : []).forEach(item => {
            if (!item) return;
            if (String(item?.fullUrl || "").replace(/\/+$/, "") === currentUrl) return;
            if (filterCategories.length && !itemHasAnyCategory(item, filterCategories)) return;
            if (filterTags.length) {
                const itemTags = (Array.isArray(item.tags) ? item.tags : []).map(normalize);
                if (!filterTags.some(t => itemTags.includes(t))) return;
            }
            const vals = getTagValuesByPrefix(item, prefix);
            if (!vals.length) return;
            const n = parseFloat(vals[0]);
            if (!isFinite(n)) return;
            if (n > currentNum && n < bestNum) {
                best = item;
                bestNum = n;
            }
        });
        return best;
    }
    function ruleMatchesCandidate(rule, candidateItem, currentItem, context) {
        const type = rule?.type;
        if (type === "sharedCategory") return itemSharesCategory(candidateItem, currentItem);
        if (type === "sharedTagPrefix") return itemSharesTagPrefix(candidateItem, currentItem, rule.prefixes || []);
        if (type === "sharedExactTag") return itemHasAnyExactTag(candidateItem, rule.values || []);
        if (type === "includeCategories") return itemHasAnyCategory(candidateItem, rule.values || []);
        if (type === "excludeCategories") return !itemHasAnyCategory(candidateItem, rule.values || []);
        if (type === "includeExactTags") return itemHasAnyExactTag(candidateItem, rule.values || []);
        if (type === "excludeExactTags") return !itemHasAnyExactTag(candidateItem, rule.values || []);
        if (type === "titleMatchesCurrentTagValue") return itemTitleMatchesCurrentTagValue(candidateItem, currentItem, rule.prefixes || []);
        if (type === "nextCollectionItemOfCategory") {
            const next = findNextCollectionItemOfCategory(context?.allItems || [], currentItem, rule);
            if (!next) return false;
            const cUrl = String(candidateItem?.fullUrl || "").replace(/\/+$/, "") || "/";
            const nUrl = String(next?.fullUrl || "").replace(/\/+$/, "") || "/";
            return cUrl && nUrl && cUrl === nUrl || String(candidateItem?.urlId || "") === String(next?.urlId || "");
        }
        if (type === "nextCollectionItemWithTag") {
            const next = findNextCollectionItemWithTag(context?.allItems || [], currentItem, rule);
            if (!next) return false;
            const cUrl = String(candidateItem?.fullUrl || "").replace(/\/+$/, "") || "/";
            const nUrl = String(next?.fullUrl || "").replace(/\/+$/, "") || "/";
            return cUrl && nUrl && cUrl === nUrl || String(candidateItem?.urlId || "") === String(next?.urlId || "");
        }
        if (type === "nextByTagValue") {
            const next = findNextByTagValue(context?.allItems || [], currentItem, rule);
            if (!next) return false;
            const cUrl = String(candidateItem?.fullUrl || "").replace(/\/+$/, "") || "/";
            const nUrl = String(next?.fullUrl || "").replace(/\/+$/, "") || "/";
            return cUrl && nUrl && cUrl === nUrl || String(candidateItem?.urlId || "") === String(next?.urlId || "");
        }
        return false;
    }
    function evaluateMatchGroups(candidateItem, currentItem, selection, context) {
        const groups = Array.isArray(selection?.match?.groups) ? selection.match.groups : [];
        if (!groups.length) return true;
        return groups.some(group => {
            const rules = Array.isArray(group.rules) ? group.rules : [];
            if (!rules.length) return false;
            const logic = String(group.logic || "or").toLowerCase();
            return logic === "and" ? rules.every(r => ruleMatchesCandidate(r, candidateItem, currentItem, context)) : rules.some(r => ruleMatchesCandidate(r, candidateItem, currentItem, context));
        });
    }
    // ════════════════════════════════════════════════════════════════
    // SCORE
    // ════════════════════════════════════════════════════════════════
    function computeCandidateScore(candidateItem, currentItem, selection) {
        if (!selection?.score?.enabled) return 0;
        const rules = Array.isArray(selection.score.rules) ? selection.score.rules : [];
        let total = 0;
        rules.forEach(rule => {
            const weight = Number(rule.weight || 0);
            if (!weight) return;
            if (rule.type === "sharedCategory" && itemSharesCategory(candidateItem, currentItem)) {
                const cur = new Set((currentItem.categories || []).map(normalize).filter(Boolean));
                (candidateItem.categories || []).forEach(c => {
                    if (cur.has(normalize(c))) total += weight;
                });
            }
            if (rule.type === "sharedTagPrefix") {
                const prefixSet = new Set((Array.isArray(rule.prefixes) ? rule.prefixes : []).map(normalize));
                const curTags = getTagObjects(currentItem).filter(t => prefixSet.has(t.prefixNorm));
                const curSet = new Set(curTags.map(t => t.rawNorm));
                getTagObjects(candidateItem).forEach(t => {
                    if (curSet.has(t.rawNorm)) total += weight;
                });
            }
            if (rule.type === "sharedExactTag") {
                (Array.isArray(rule.values) ? rule.values : []).forEach(v => {
                    if (itemHasTag(candidateItem, v) && itemHasTag(currentItem, v)) total += weight;
                });
            }
            if (rule.type === "titleMatchesCurrentTagValue") {
                if (itemTitleMatchesCurrentTagValue(candidateItem, currentItem, rule.prefixes || [])) total += weight;
            }
        });
        return total;
    }
    // ════════════════════════════════════════════════════════════════
    // CONTRAINTES
    // ════════════════════════════════════════════════════════════════
    function passesConstraints(candidateItem, currentItem, selection) {
        const c = selection?.constraints || {};
        if (c.requirePublished) {
            const state = candidateItem.workflowState;
            if (state !== 1 && state !== "PUBLISHED") return false;
            // 'state-only' : on ignore publishOn (date éditoriale future tolérée)
            if (c.requirePublished !== "state-only") {
                if (candidateItem.publishOn && Number(candidateItem.publishOn) > Date.now()) return false;
            }
        }
        if (c.requireImage && !getAssetUrl(candidateItem)) return false;
        if (c.excludeCurrentItem) {
            const curUrl = String(currentItem?.fullUrl || "").replace(/\/+$/, "") || "/";
            const itemUrl = String(candidateItem?.fullUrl || "").replace(/\/+$/, "") || "/";
            if (itemUrl === curUrl) return false;
            const curTitle = normalize(currentItem?.title || "");
            const itemTitle = normalize(candidateItem?.title || "");
            if (curTitle && itemTitle === curTitle) return false;
        }
        return true;
    }
    // ════════════════════════════════════════════════════════════════
    // TRI
    // ════════════════════════════════════════════════════════════════
    function shuffleArray(arr) {
        const clone = arr.slice();
        for (let i = clone.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ clone[i], clone[j] ] = [ clone[j], clone[i] ];
        }
        return clone;
    }
    function sortItemsByRules(items, sortRules) {
        const list = items.slice();
        const rules = Array.isArray(sortRules) ? sortRules : [];
        if (!rules.length) return list;
        if (rules.some(r => r?.type === "random")) return shuffleArray(list);
        list.sort((a, b) => {
            for (const rule of rules) {
                const type = rule?.type;
                const dir = String(rule?.direction || "asc").toLowerCase() === "desc" ? -1 : 1;
                if (type === "score") {
                    const diff = Number(a._score || 0) - Number(b._score || 0);
                    if (diff !== 0) return diff * dir;
                }
                if (type === "date") {
                    const diff = Number(a.timestamp || 0) - Number(b.timestamp || 0);
                    if (diff !== 0) return diff * dir;
                }
                if (type === "title") {
                    const av = normalize(a.title || "");
                    const bv = normalize(b.title || "");
                    if (av !== bv) return av.localeCompare(bv) * dir;
                }
                if (type === "collection") {
                    const diff = Number(a.displayIndex ?? 999999) - Number(b.displayIndex ?? 999999);
                    if (diff !== 0) return diff * dir;
                }
                // Tri par valeur ISO d'un tag prefixé
                if (type === "tagPrefix" && rule.prefix) {
                    const prefixNorm = normalize(String(rule.prefix).replace(/:$/, ""));
                    const getTagSortVal = item => {
                        const vals = getTagValuesByPrefix(item, prefixNorm);
                        if (!vals.length) return Infinity;
                        const raw = String(vals[0]).trim();
                        // Valeur purement numérique (ex: Numéro: 4) → tri numérique
                        const num = Number(raw);
                        if (!isNaN(num) && raw !== "") return num;
                        // Sinon tenter ISO timestamp
                        return getISOTimestamp(raw);
                    };
                    const diff = getTagSortVal(a) - getTagSortVal(b);
                    if (diff !== 0) return diff * dir;
                }
            }
            return 0;
        });
        return list;
    }
    // ════════════════════════════════════════════════════════════════
    // FALLBACK
    // ════════════════════════════════════════════════════════════════
    function applyFallbackFill(selectedItems, allItems, currentItem, selection, CFG) {
        const fallback = selection?.fallback || {};
        const limit = Number(selection?.limit || selectedItems.length || 0);
        if (!fallback.enabled || !fallback.fillToLimit || !limit) {
            return selectedItems.slice(0, limit || selectedItems.length);
        }
        if (selectedItems.length >= limit) return selectedItems.slice(0, limit);
        const usedUrls = new Set(selectedItems.map(i => String(i.fullUrl || "")));
        const constraints = selection?.constraints || {};
        const fallbackSelection = fallback.matchGroups ? {
            match: {
                groups: fallback.matchGroups
            }
        } : null;
        let pool = allItems.filter(item => {
            if (!passesConstraints(item, currentItem, {
                constraints: constraints
            })) return false;
            if (fallbackSelection && !evaluateMatchGroups(item, currentItem, fallbackSelection, {
                allItems: allItems
            })) return false;
            return true;
        }).map(item => mapItemForRender(item, CFG)).filter(item => {
            const url = String(item.fullUrl || "");
            return url && !usedUrls.has(url);
        });
        pool = uniqBy(pool, i => String(i.fullUrl || i.title || ""));
        pool = sortItemsByRules(pool, fallback.sort || [ {
            type: "random"
        } ]);
        const result = selectedItems.slice();
        for (const item of pool) {
            if (result.length >= limit) break;
            result.push({
                ...item,
                _score: 0,
                _isFallback: true
            });
        }
        return result.slice(0, limit);
    }
    // ════════════════════════════════════════════════════════════════
    // FETCH
    // ════════════════════════════════════════════════════════════════
    function getCollectionCacheOptions(CFG) {
        // DEV_MODE écrase tout : zéro cache
        if (DEV_MODE) return {
            useMemoryCache: false,
            useSessionCache: false
        };
        // Options de cache depuis _shared si définies, sinon depuis le bloc
        const sharedCache = SHARED_CONFIG?.cache || {};
        return {
            useMemoryCache: sharedCache.useMemoryCache ?? CFG?.performance?.useCollectionMemoryCache !== false,
            useSessionCache: sharedCache.useSessionCache ?? CFG?.performance?.useCollectionSessionCache === true
        };
    }
    function buildCollectionRequestOptions(maxPages, cacheOptions, keepFields) {
        const opts = cacheOptions || {};
        const fields = Array.isArray(keepFields) ? keepFields : [
            'id',
            'title',
            'fullUrl',
            'urlId',
            'assetUrl',
            'mediaFocalPoint',
            'categories',
            'tags',
            'excerpt',
            'location',
            'displayIndex',
            'workflowState',
            'startDate',
            'publishOn',
            'addedOn',
            'updatedOn'
        ];

        return {
            maxPages: maxPages || 1,
            ttl: 900,
            memoryCache: opts.useMemoryCache !== false,
            sessionCache: opts.useSessionCache === true,
            credentials: 'same-origin',
            keepFields: fields,
            stripFields: []
        };
    }

    async function fetchCollectionStateFromPath(path, maxPages, jsonFormatSuffix, cacheOptions, keepFields) {
        if (window.CollectionData && typeof window.CollectionData.get === 'function') {
            const options = buildCollectionRequestOptions(maxPages, cacheOptions, keepFields);

            if (typeof window.CollectionData.getState === 'function') {
                return window.CollectionData.getState(path, options);
            }

            const items = await window.CollectionData.get(path, options);
            return {
                items: items,
                pagesLoaded: Number(maxPages || 1),
                complete: maxPages === 'all',
                fetchError: null,
                hasNext: maxPages !== 'all'
            };
        }

        throw new Error('CollectionData unavailable');
    }

    async function fetchCollectionItemsFromPath(path, maxPages, jsonFormatSuffix, cacheOptions, keepFields) {
        const state = await fetchCollectionStateFromPath(path, maxPages, jsonFormatSuffix, cacheOptions, keepFields);
        return state.items || [];
    }
    async function fetchCollectionState(CFG, maxPages) {
        return fetchCollectionStateFromPath(
            CFG.sourceCollection.path,
            maxPages || CFG.performance?.maxPages || 1,
            CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
            getCollectionCacheOptions(CFG),
            CFG.performance?.keepFields
        );
    }
    async function fetchCurrentItemCollectionState(CFG, maxPages) {
        const path = CFG.currentItem?.sourceCollection?.path || CFG.sourceCollection?.path;
        const suffix = CFG.currentItem?.sourceCollection?.jsonFormatSuffix || CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX;

        return fetchCollectionStateFromPath(
            path,
            maxPages || CFG.performance?.maxPages || 1,
            suffix,
            getCollectionCacheOptions(CFG),
            CFG.performance?.keepFields
        );
    }
    // ════════════════════════════════════════════════════════════════
    // ITEM COURANT
    // ════════════════════════════════════════════════════════════════
    function findCurrentItem(items, CFG) {
        const pathname = getCurrentPathname();
        const override = CFG.currentItem?.overrideForDev || null;
        if (override?.enabled && (!override.bodyId || document.body.id === override.bodyId)) {
            return {
                id: override.bodyId || null,
                title: cleanText(override.title || document.title || "Draft item"),
                fullUrl: override.fullUrl || pathname,
                urlId: (override.fullUrl || pathname).split("/").filter(Boolean).pop() || "",
                tags: Array.isArray(override.tags) ? override.tags.map(cleanText) : [],
                categories: Array.isArray(override.categories) ? override.categories.map(cleanText) : [],
                assetUrl: override.assetUrl || null,
                mediaFocalPoint: override.mediaFocalPoint || null,
                displayIndex: Number(override.displayIndex || 999999),
                workflowState: 1,
                publishOn: Date.now()
            };
        }
        if (CFG.currentItem?.matchBy === "pathname") {
            return items.find(item => {
                const fullUrl = String(item.fullUrl || "").replace(/\/+$/, "") || "/";
                return fullUrl === pathname;
            }) || null;
        }
        return null;
    }
    // ════════════════════════════════════════════════════════════════
    // CONSTRUCTION DOM — ÉLÉMENTS
    // ════════════════════════════════════════════════════════════════
    function getHeadingText(items, CFG) {
        return items.length === 1 && CFG.headingSingular ? CFG.headingSingular : CFG.heading || "";
    }
    function buildTagPrefixField(item, fieldConfig, overrideDisplayFormat) {
        if (!fieldConfig?.prefix) return null;
        let values = getTagValuesByPrefix(item, fieldConfig.prefix);
        if (!values.length) return null;
        if (fieldConfig.maxItems) values = values.slice(0, Number(fieldConfig.maxItems));
        const el = document.createElement("div");
        el.className = fieldConfig.className || "related-block__tag-prefix";
        addClasses(el, "cb-card__tag-field rb-card__tag-field");
        const label = cleanText(fieldConfig.label || "");
        const joinWith = fieldConfig.joinWith || ", ";
        const displayFormat = overrideDisplayFormat ?? fieldConfig.displayFormat ?? null;
        const locale = fieldConfig.locale || null;
        const formattedValues = values.map(v => displayFormat !== null ? formatISOTag(v, displayFormat, locale) : v).filter(Boolean);
        const text = formattedValues.join(joinWith);
        const fullText = label ? label + " " + text : text;
        // Icône optionnelle
        const icon = String(fieldConfig.icon || "").trim();
        if (icon) {
            const iconEl = document.createElement("span");
            iconEl.className = "related-block__tag-prefix-icon";
            iconEl.setAttribute("aria-hidden", "true");
            if (String(fieldConfig.iconType || "text").toLowerCase() === "html") {
                iconEl.innerHTML = icon;
            } else {
                iconEl.textContent = icon;
            }
            el.appendChild(iconEl);
            const textEl = document.createElement("span");
            textEl.className = "cb-card__tag-value rb-card__tag-value related-block__tag-prefix-text";
            textEl.textContent = fullText;
            el.appendChild(textEl);
        } else {
            el.textContent = fullText;
        }
        return el;
    }
    function buildMetaElement(item) {
        const cats = Array.isArray(item.categories) ? item.categories.filter(Boolean) : [];
        if (!cats.length) return null;
        const meta = document.createElement("div");
        meta.className = "cb-card__meta rb-card__meta cb-card__categories rb-card__categories related-block__meta";
        cats.forEach(cat => {
            const span = document.createElement("span");
            span.className = "cb-card__category rb-card__category related-block__category";
            span.textContent = cleanText(cat);
            meta.appendChild(span);
        });
        return meta;
    }
    function buildTitleElement(item) {
        const el = document.createElement("div");
        el.className = "cb-card__title rb-card__title related-block__title";
        el.textContent = cleanText(item.title || "");
        return el;
    }
    function buildExcerptElement(item) {
        if (!item.excerpt) return null;
        const el = document.createElement("div");
        el.className = "cb-card__excerpt rb-card__excerpt related-block__excerpt";
        el.textContent = cleanText(item.excerpt);
        return el;
    }
    function buildLocationElement(item) {
        if (!item.locationText) return null;
        const el = document.createElement("div");
        el.className = "cb-card__location rb-card__location related-block__location";
        el.textContent = cleanText(item.locationText);
        return el;
    }
    function buildTagPrefixElements(item, CFG, filterPrefixes, overrideDisplayFormat) {
        let fields = Array.isArray(CFG.display?.tagPrefixFields) ? CFG.display.tagPrefixFields : [];
        if (Array.isArray(filterPrefixes) && filterPrefixes.length) {
            const prefixSet = new Set(filterPrefixes.map(p => normalize(String(p).replace(/:$/, ""))));
            fields = fields.filter(fc => prefixSet.has(normalize(String(fc?.prefix || "").replace(/:$/, ""))));
        }
        return fields.map(fc => buildTagPrefixField(item, fc, overrideDisplayFormat)).filter(Boolean);
    }
    function buildImageElement(item, CFG) {
        if (!CFG.display?.showImage || !item.assetUrl) return null;
        const media = document.createElement("div");
        media.className = "cb-card__media rb-card__media cb-card__img-wrap rb-card__img-wrap related-block__image";
        const img = document.createElement("img");
        img.className = "cb-card__img rb-card__img related-block__img";
        const srcsetWidths = Array.isArray(CFG.display?.srcsetWidths) ? CFG.display.srcsetWidths : [ 300, 500, 750, 1e3, 1500 ];
        const fallbackSrc = `${item.assetUrl}?format=750w`;
        img.src = fallbackSrc;
        img.srcset = srcsetWidths.filter(w => Number(w) <= 1500).map(w => `${item.assetUrl}?format=${w}w ${w}w`).join(", ");
        img.sizes = CFG.display?.imageSizes || DEFAULT_IMAGE_SIZES;
        img.alt = cleanText(item.title || "");
        img.loading = "lazy";
        img.decoding = "async";
        img.fetchPriority = "low";
        img.style.objectPosition = item.mediaFocalPoint && typeof item.mediaFocalPoint.x === "number" && typeof item.mediaFocalPoint.y === "number" ? `${Math.round(item.mediaFocalPoint.x * 100)}% ${Math.round(item.mediaFocalPoint.y * 100)}%` : "50% 50%";
        media.appendChild(img);
        return media;
    }
    /**
   * Construit les nœuds DOM pour un type de contenu.
   * Accepte une string ('image', 'title'…) ou un objet descriptor
   * ({ type: 'tagPrefix', prefix: 'Date:', displayFormat: 'day' }).
   */
    function buildContentNodesByType(definition, item, CFG) {
        const descriptor = typeof definition === "string" ? {
            type: definition
        } : definition || {};
        const type = descriptor.type;
        if (type === "image") {
            const el = buildImageElement(item, CFG);
            return el ? [ el ] : [];
        }
        if (type === "meta" && CFG.display?.showCategories) {
            const el = buildMetaElement(item);
            return el ? [ el ] : [];
        }
        if (type === "title" && CFG.display?.showTitle) {
            return [ buildTitleElement(item) ];
        }
        if (type === "excerpt" && CFG.display?.showExcerpt) {
            const el = buildExcerptElement(item);
            return el ? [ el ] : [];
        }
        if (type === "location" && CFG.display?.showLocation) {
            const el = buildLocationElement(item);
            return el ? [ el ] : [];
        }
        if (type === "tagPrefix") {
            const filterPrefixes = Array.isArray(descriptor.prefixes) ? descriptor.prefixes : descriptor.prefix ? [ descriptor.prefix ] : null;
            // Le descriptor peut surcharger le displayFormat du tagPrefixField
            const overrideFormat = descriptor.displayFormat !== undefined ? descriptor.displayFormat : undefined;
            return buildTagPrefixElements(item, CFG, filterPrefixes, overrideFormat);
        }
        return [];
    }
    function buildGroupedContent(item, CFG) {
        const groups = Array.isArray(CFG.display?.groups) ? CFG.display.groups : [];
        if (!groups.length) return null;
        const fragment = document.createDocumentFragment();
        let hasContent = false;
        groups.forEach(group => {
            const children = Array.isArray(group?.children) ? group.children : [];
            if (!children.length) return;
            const wrapper = document.createElement(group?.tag || "div");
            String(group?.className || "").split(/\s+/).map(s => s.trim()).filter(Boolean).forEach(cls => wrapper.classList.add(cls));
            children.forEach(child => {
                buildContentNodesByType(child, item, CFG).forEach(node => wrapper.appendChild(node));
            });
            if (wrapper.childNodes.length) {
                fragment.appendChild(wrapper);
                hasContent = true;
            }
        });
        return hasContent ? fragment : null;
    }
    // ════════════════════════════════════════════════════════════════
    // CONSTRUCTION DOM — BLOC
    // ════════════════════════════════════════════════════════════════
    function createLoader() {
        const loader = document.createElement("div");
        loader.className = "related-block__loader";
        loader.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement("span");
            dot.className = "related-block__loader-dot";
            loader.appendChild(dot);
        }
        return loader;
    }
    function buildHeadingCta(CFG) {
        const cta = CFG.headingCta || {};
        const text = cleanText(cta.text || "");
        const href = String(cta.href || "").trim();
        if (!text || !href) return null;
        const link = document.createElement("a");
        link.className = "related-block__heading-cta";
        link.href = href;
        if (cta.newTab) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        }
        const textEl = document.createElement("span");
        textEl.className = "related-block__heading-cta-text";
        textEl.textContent = text;
        link.appendChild(textEl);
        const icon = String(cta.icon || "");
        if (icon) {
            const iconEl = document.createElement("span");
            iconEl.className = "related-block__heading-cta-icon";
            if (String(cta.iconType || "text").toLowerCase() === "html") {
                iconEl.innerHTML = icon;
            } else {
                iconEl.textContent = icon;
            }
            link.appendChild(iconEl);
        }
        return link;
    }
    function buildHeadingElement(items, CFG, forceHeading) {
        const headingText = forceHeading ? CFG.heading || CFG.headingSingular || "" : getHeadingText(items, CFG);
        const headingCta = buildHeadingCta(CFG);
        if (!headingText && !headingCta) return null;
        const heading = document.createElement("div");
        heading.className = "related-block__heading";
        if (headingText) {
            const tag = document.createElement(CFG.headingTag || "h3");
            tag.className = "related-block__heading-text";
            tag.textContent = headingText;
            heading.appendChild(tag);
        }
        if (headingCta) heading.appendChild(headingCta);
        return heading;
    }
    function applyStateClasses(section) {
        const toRemove = [ "related-block--has-heading", "related-block--has-image", "related-block--has-title", "related-block--has-meta", "related-block--has-excerpt", "related-block--has-location", "related-block--has-tag-prefix", "related-block--has-heading-cta", "related-block--single-item", "related-block--multiple-items", "related-block--is-empty" ];
        toRemove.forEach(cls => section.classList.remove(cls));
        const checks = [ [ ".related-block__heading", "related-block--has-heading" ], [ ".related-block__heading-cta", "related-block--has-heading-cta" ], [ ".related-block__image", "related-block--has-image" ], [ ".related-block__title", "related-block--has-title" ], [ ".related-block__meta", "related-block--has-meta" ], [ ".related-block__excerpt", "related-block--has-excerpt" ], [ ".related-block__location", "related-block--has-location" ], [ ".related-block__tag-prefix", "related-block--has-tag-prefix" ] ];
        checks.forEach(([ sel, cls ]) => {
            if (section.querySelector(sel)) section.classList.add(cls);
        });
        const items = section.querySelectorAll(".related-block__item");
        if (items.length === 1) section.classList.add("related-block--single-item");
        if (items.length > 1) section.classList.add("related-block--multiple-items");
    }
    function buildCard(item, CFG, extraClasses, currentItem) {
        const card = document.createElement("a");
        card.className = "cb-card rb-card related-block__item";
        card.href = item.fullUrl || CFG.sourceCollection.path + "/" + item.urlId;
        extraClasses.forEach(cls => card.classList.add(cls + "__item"));
        // Marquer l'item courant (ex: pour la bande parcours avec excludeCurrentItem: false)
        if (currentItem) {
            const curUrl = String(currentItem.fullUrl || "").replace(/\/+$/, "") || "/";
            const itemUrl = String(item.fullUrl || "").replace(/\/+$/, "") || "/";
            if (itemUrl && curUrl && itemUrl === curUrl) {
                card.dataset.current = "true";
                card.setAttribute("aria-current", "page");
            }
        }
        if (Array.isArray(CFG.display?.groups) && CFG.display.groups.length) {
            const groupedContent = buildGroupedContent(item, CFG);
            if (groupedContent) card.appendChild(groupedContent);
            return card;
        }
        if (CFG.display?.showImage && item.assetUrl) {
            const media = buildImageElement(item, CFG);
            if (media) card.appendChild(media);
        }
        const content = document.createElement("div");
        content.className = "cb-card__body rb-card__body related-block__content";
        const order = Array.isArray(CFG.display?.order) ? CFG.display.order : [ "meta", "title", "excerpt", "location" ];
        order.forEach(type => {
            buildContentNodesByType(type, item, CFG).forEach(node => {
                if (node.classList?.contains("related-block__image")) return;
                content.appendChild(node);
            });
        });
        card.appendChild(content);
        return card;
    }
    /**
   * Attribue un id unique à la section du bloc.
   * Par défaut : le key de la config (ex. "related-events").
   * Si un élément avec cet id existe déjà dans le DOM,
   * on suffixe : "related-events-2", "-3", etc.
   */
    function assignBlockId(key) {
        const base = slugifyToken(key || "related-block");
        if (!document.getElementById(base)) return base;
        let n = 2;
        while (document.getElementById(base + "-" + n)) n++;
        return base + "-" + n;
    }
    function buildBlockShell(CFG) {
        const section = document.createElement("section");
        section.className = "related-block related-block--is-loading";
        section.dataset.relatedKey = CFG.key;
        section.id = assignBlockId(CFG.key);
        String(CFG.classes?.block || "").split(/\s+/).map(s => s.trim()).filter(Boolean).forEach(cls => section.classList.add(cls));
        const inner = document.createElement("div");
        inner.className = "related-block__inner";
        if (!CFG.loading?.hideLoader) inner.appendChild(createLoader());
        section.appendChild(inner);
        applyStateClasses(section);
        return section;
    }
    /**
   * Construit le <div class="related-block__list"> avec :
   *   - data-count="N"
   *   - related-block__list--single  (N === 1)
   *   - related-block__list--multiple (N > 1)
   */
    function buildList(items, CFG, currentItem) {
        const list = document.createElement("div");
        const count = items.length;
        list.className = "related-block__list";
        list.dataset.count = count;
        if (count === 1) list.classList.add("related-block__list--single");
        if (count > 1) list.classList.add("related-block__list--multiple");
        const extraClasses = String(CFG.classes?.block || "").split(/\s+/).map(s => s.trim()).filter(Boolean);
        items.forEach(item => list.appendChild(buildCard(item, CFG, extraClasses, currentItem)));
        return list;
    }
    function replaceBlockContent(section, items, CFG, currentItem) {
        const inner = section.querySelector(".related-block__inner");
        if (!inner) return;
        inner.innerHTML = "";
        const heading = buildHeadingElement(items, CFG, false);
        if (heading) inner.appendChild(heading);
        inner.appendChild(buildList(items, CFG, currentItem));
        section.classList.remove("related-block--is-loading");
        applyStateClasses(section);
    }
    function replaceBlockWithEmptyState(section, CFG) {
        const inner = section.querySelector(".related-block__inner");
        if (!inner) return;
        inner.innerHTML = "";
        const heading = buildHeadingElement([], CFG, true);
        if (heading) inner.appendChild(heading);
        const message = cleanText(CFG.emptyState?.message || "");
        if (message) {
            const empty = document.createElement("div");
            empty.className = "related-block__empty";
            empty.textContent = message;
            inner.appendChild(empty);
        }
        section.classList.remove("related-block--is-loading");
        section.classList.add("related-block--is-empty");
        applyStateClasses(section);
    }
    function buildBlock(items, CFG, currentItem) {
        const section = document.createElement("section");
        section.className = "related-block";
        section.dataset.relatedKey = CFG.key;
        section.id = assignBlockId(CFG.key);
        String(CFG.classes?.block || "").split(/\s+/).map(s => s.trim()).filter(Boolean).forEach(cls => section.classList.add(cls));
        const inner = document.createElement("div");
        inner.className = "related-block__inner";
        const heading = buildHeadingElement(items, CFG, false);
        if (heading) inner.appendChild(heading);
        inner.appendChild(buildList(items, CFG, currentItem));
        section.appendChild(inner);
        applyStateClasses(section);
        return section;
    }
    // ════════════════════════════════════════════════════════════════
    // RUNNER
    // ════════════════════════════════════════════════════════════════
    function matchesDevGuard(CFG) {
        const guard = CFG.devGuard || {};
        if (!guard.enabled) return true;
        if (guard.bodyId && document.body.id !== guard.bodyId) return false;
        return true;
    }
    function getInsertTarget(selector) {
        return document.querySelector(selector || "");
    }
    function alreadyInjected(target, cfgKey) {
        return !!target.querySelector(`:scope > .related-block[data-related-key="${cfgKey}"]`);
    }
    function getRelatedBlockOrder() {
        if (Array.isArray(SHARED_CONFIG?.blockOrder) && SHARED_CONFIG.blockOrder.length) {
            return SHARED_CONFIG.blockOrder;
        }
        return CONFIGS.map(cfg => cfg?.key).filter(Boolean);
    }
    function getRelatedBlockOrderIndex(key) {
        const order = getRelatedBlockOrder();
        const index = order.indexOf(key);
        return index === -1 ? 9999 : index;
    }
    function reorderRelatedBlocks(target) {
        if (!target) return;
        const blocks = Array.from(target.querySelectorAll(":scope > .related-block[data-related-key]"));
        if (blocks.length < 2) return;
        blocks.sort((a, b) => {
            const ai = getRelatedBlockOrderIndex(a.dataset.relatedKey || "");
            const bi = getRelatedBlockOrderIndex(b.dataset.relatedKey || "");
            return ai - bi;
        }).forEach(block => target.appendChild(block));
    }
    function insertInto(target, el, mode) {
        if ((mode || "append").toLowerCase() === "prepend") {
            target.insertAdjacentElement("afterbegin", el);
        } else {
            target.insertAdjacentElement("beforeend", el);
        }
        reorderRelatedBlocks(target);
    }
    function createRunner(CFG) {
        CFG = Object.assign({
            enabled: true,
            key: "related-block",
            debug: false,
            devGuard: {
                enabled: false
            },
            requiredBodyClasses: [],
            sourceCollection: {
                path: ""
            },
            currentItem: {
                matchBy: "pathname",
                sourceCollection: null
            },
            insertion: {
                targetSelector: "",
                mode: "append"
            },
            heading: "",
            headingSingular: "",
            headingTag: "h3",
            headingCta: {
                text: "",
                href: "",
                icon: "",
                iconType: "text",
                newTab: false
            },
            classes: {
                block: ""
            },
            display: {
                maxItems: 4,
                showImage: true,
                showTitle: true,
                showCategories: true,
                showExcerpt: false,
                showLocation: false,
                order: [ "meta", "title", "excerpt", "location" ],
                tagPrefixFields: [],
                groups: [],
                srcsetWidths: DEFAULT_SRCSET_WIDTHS,
                imageSizes: DEFAULT_IMAGE_SIZES
            },
            loading: {
                hideLoader: false
            },
            emptyState: {
                message: ""
            },
            preload: {
                enabled: false,
                includeSourceCollection: true,
                includeCurrentItemSource: false,
                collections: [],
                maxPages: null
            },
            selection: {
                constraints: {
                    requirePublished: true,
                    requireImage: true,
                    excludeCurrentItem: false
                },
                match: {
                    groups: []
                },
                score: {
                    enabled: false,
                    rules: [],
                    minScore: 0
                },
                sort: [ {
                    type: "date",
                    direction: "desc"
                } ],
                limit: 4,
                fallback: {
                    enabled: false,
                    fillToLimit: false,
                    sort: [ {
                        type: "random"
                    } ],
                    matchGroups: null
                }
            },
            performance: {
                useSessionStorage: true,
                maxPages: 1,
                progressiveMaxPages: 'all',
                useCollectionMemoryCache: true,
                useCollectionSessionCache: false
            }
        }, CFG || {});
        if (CFG.enabled === false) return null;
        if (!matchesDevGuard(CFG)) return null;
        if (!CFG.requiredBodyClasses.every(cls => document.body.classList.contains(cls))) return null;
        let observer = null;
        function getInitialMaxPages(CFG) {
  return CFG.performance?.maxPages || 1;
}

function getProgressiveMaxPages(CFG) {
  const v = CFG.performance?.progressiveMaxPages;
  return v === undefined ? 'all' : v;
}

function canLoadMorePages(currentPages, maxPages) {
  if (maxPages === 'all') return true;
  return Number(currentPages || 1) < Number(maxPages || 1);
}

function getNextPagesValue(currentPages, maxPages) {
  if (maxPages === 'all') return Number(currentPages || 1) + 1;
  return Math.min(Number(currentPages || 1) + 1, Number(maxPages || 1));
}
        async function apply() {
            const target = getInsertTarget(CFG.insertion?.targetSelector);
            if (!target) return false;
            if (alreadyInjected(target, CFG.key)) {
                syncBodyRelatedBlockClasses();
                return true;
            }
            const shell = buildBlockShell(CFG);
            insertInto(target, shell, CFG.insertion?.mode);
            let items;
            let sourceState;
            try {
                sourceState = await fetchCollectionState(CFG, CFG.performance?.maxPages || 1);
                items = sourceState.items || [];
            } catch (e) {
                if (CFG.debug) console.warn("[RB]", CFG.key, "fetchCollectionItems failed", e);
                shell.remove();
                syncBodyRelatedBlockClasses();
                return false;
            }
            if (!Array.isArray(items) || !items.length) {
                shell.remove();
                syncBodyRelatedBlockClasses();
                return false;
            }
            let currentItemSourceItems = items;
let currentItemLoadedPages = getInitialMaxPages(CFG);
const currentSourcePath = CFG.currentItem?.sourceCollection?.path || CFG.sourceCollection?.path;
const sourcePath = CFG.sourceCollection?.path || "";
const progressiveMaxPages = getProgressiveMaxPages(CFG);
let currentItemSourceState = currentSourcePath === sourcePath ? sourceState : null;
let currentItemSourceComplete = !!(currentItemSourceState && (currentItemSourceState.complete || currentItemSourceState.fetchError));

if (currentSourcePath !== sourcePath) {
    try {
        currentItemSourceState = await fetchCurrentItemCollectionState(CFG, currentItemLoadedPages);
        currentItemSourceItems = currentItemSourceState.items || [];
        currentItemSourceComplete = !!(currentItemSourceState.complete || currentItemSourceState.fetchError);
    } catch (e) {
        if (CFG.debug) console.warn("[RB]", CFG.key, "fetchCurrentItemCollectionItems failed", e);
        shell.remove();
        syncBodyRelatedBlockClasses();
        return false;
    }
}

let currentItem = findCurrentItem(currentItemSourceItems, CFG);

while (!currentItem && !currentItemSourceComplete && canLoadMorePages(currentItemLoadedPages, progressiveMaxPages)) {
    currentItemLoadedPages = getNextPagesValue(currentItemLoadedPages, progressiveMaxPages);

    try {
        currentItemSourceState = await fetchCurrentItemCollectionState(CFG, currentItemLoadedPages);
        currentItemSourceItems = currentItemSourceState.items || [];
        currentItemSourceComplete = !!(currentItemSourceState.complete || currentItemSourceState.fetchError);
    } catch (e) {
        if (CFG.debug) console.warn("[RB]", CFG.key, "progressive current item fetch failed", e);
        break;
    }

    currentItem = findCurrentItem(currentItemSourceItems, CFG);
}

if (!currentItem) {
    shell.remove();
    syncBodyRelatedBlockClasses();
    return false;
}

if (currentSourcePath === sourcePath && currentItemSourceState) {
    items = currentItemSourceItems;
    sourceState = currentItemSourceState;
}
            let sourceLoadedPages = currentSourcePath === sourcePath ? currentItemLoadedPages : getInitialMaxPages(CFG);
            let sourceComplete = !!(sourceState && (sourceState.complete || sourceState.fetchError));

function computeFinalItems(allItems) {
    const candidates = [];

    allItems.forEach(item => {
        if (!item) return;
        if (!passesConstraints(item, currentItem, CFG.selection)) return;
        if (!evaluateMatchGroups(item, currentItem, CFG.selection, {
            allItems: allItems
        })) return;

        const score = computeCandidateScore(item, currentItem, CFG.selection);

        if (
            CFG.selection?.score?.enabled &&
            score < Number(CFG.selection.score.minScore || 0)
        ) return;

        candidates.push({
            ...mapItemForRender(item, CFG),
            _score: score
        });
    });

    let result = sortItemsByRules(candidates, CFG.selection?.sort || []);
    result = uniqBy(result, i => String(i.fullUrl || i.title || ""));

    const limit = Number(CFG.selection?.limit || CFG.display?.maxItems || result.length);

    if (limit > 0) result = result.slice(0, limit);

return result;
}

let finalItems = computeFinalItems(items);
const limit = Number(CFG.selection?.limit || CFG.display?.maxItems || finalItems.length);

while (
    limit > 0 &&
    finalItems.length < limit &&
    !sourceComplete &&
    canLoadMorePages(sourceLoadedPages, progressiveMaxPages)
) {
    sourceLoadedPages = getNextPagesValue(sourceLoadedPages, progressiveMaxPages);

    try {
        sourceState = await fetchCollectionState(CFG, sourceLoadedPages);
        const moreItems = sourceState.items || [];
        sourceComplete = !!(sourceState.complete || sourceState.fetchError);

        if (!Array.isArray(moreItems)) {
            break;
        }

        items = moreItems;
        finalItems = computeFinalItems(items);
    } catch (e) {
        if (CFG.debug) console.warn("[RB]", CFG.key, "progressive candidates fetch failed", e);
        break;
    }
}

finalItems = applyFallbackFill(finalItems, items, currentItem, {
    ...CFG.selection,
    limit: limit
}, CFG);
            
            if (!finalItems.length) {
                if (CFG.emptyState?.message) {
                    replaceBlockWithEmptyState(shell, CFG);
                    syncBodyRelatedBlockClasses();
                    return true;
                }
                shell.remove();
                syncBodyRelatedBlockClasses();
                return false;
            }
            replaceBlockContent(shell, finalItems, CFG, currentItem);
            syncBodyRelatedBlockClasses();
            return true;
        }
        async function start() {
            const ok = await apply();
            if (ok) return;
            observer = new MutationObserver(async () => {
                const target = getInsertTarget(CFG.insertion?.targetSelector);
                if (!target) return;
                if (alreadyInjected(target, CFG.key)) {
                    syncBodyRelatedBlockClasses();
                    if (observer) observer.disconnect();
                    return;
                }
                const injected = await apply();
                if (injected && observer) observer.disconnect();
            });
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
        return {
            start: start
        };
    }
    // ════════════════════════════════════════════════════════════════
    // PRÉCHARGEMENT
    // ════════════════════════════════════════════════════════════════
    function buildPreloadQueue() {
        const queue = [];
        CONFIGS.forEach(CFG => {
            if (!CFG || CFG.enabled === false) return;
            if (!matchesDevGuard(CFG)) return;
            if (!CFG.requiredBodyClasses.every(cls => document.body.classList.contains(cls))) return;
            if (CFG.preload?.enabled !== true) return;
            const maxPages = CFG.preload?.maxPages || CFG.performance?.maxPages || 5;
            (Array.isArray(CFG.preload?.collections) ? CFG.preload.collections : []).forEach(col => {
                if (col?.path) queue.push({
                    path: col.path,
                    maxPages: col.maxPages || maxPages,
                    jsonFormatSuffix: col.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
                    cacheOptions: getCollectionCacheOptions(CFG)
                });
            });
            if (CFG.preload?.includeSourceCollection !== false && CFG.sourceCollection?.path) {
                queue.push({
                    path: CFG.sourceCollection.path,
                    maxPages: maxPages,
                    jsonFormatSuffix: CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
                    cacheOptions: getCollectionCacheOptions(CFG)
                });
            }
            if (CFG.preload?.includeCurrentItemSource === true && CFG.currentItem?.sourceCollection?.path) {
                queue.push({
                    path: CFG.currentItem.sourceCollection.path,
                    maxPages: maxPages,
                    jsonFormatSuffix: CFG.currentItem.sourceCollection.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
                    cacheOptions: getCollectionCacheOptions(CFG)
                });
            }
        });
        return uniqBy(queue.filter(i => i.path), i => [ i.path, i.maxPages, i.jsonFormatSuffix ].join("::"));
    }
    function runPreloadQueue() {
        const queue = buildPreloadQueue();
        if (!queue.length) return;
        const runner = async () => {
            for (const item of queue) {
                try {
                    await fetchCollectionItemsFromPath(item.path, item.maxPages, item.jsonFormatSuffix, item.cacheOptions);
                } catch (_) {}
            }
        };
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(runner, {
                timeout: 1500
            });
        } else {
            setTimeout(runner, 300);
        }
    }
    function shouldLazyStartRelated() {
        if (!("IntersectionObserver" in window)) return false;
        return true;
    }
    function startRunnerWhenNearTarget(runner, CFG) {
        const target = getInsertTarget(CFG.insertion?.targetSelector);
        if (!target || !shouldLazyStartRelated()) {
            runner.start();
            return;
        }
        const lazyInit = CFG.performance?.lazyInit !== false;
        if (!lazyInit) {
            runner.start();
            return;
        }
        const observer = new IntersectionObserver(entries => {
            if (!entries[0].isIntersecting) return;
            observer.disconnect();
            runner.start();
        }, {
            rootMargin: "1200px 0px"
        });
        observer.observe(target);
    }

      function runSharedCollections() {
    if (!SHARED_CONFIG) return;
    if (SHARED_CONFIG.preload !== true) return;

    const collections = Array.isArray(SHARED_CONFIG.collections)
      ? SHARED_CONFIG.collections
      : [];

    if (!collections.length) return;

    const opts = {
      useMemoryCache: DEV_MODE ? false : (SHARED_CONFIG.cache?.useMemoryCache !== false),
      useSessionCache: DEV_MODE ? false : (SHARED_CONFIG.cache?.useSessionCache === true)
    };

    const runner = async () => {
      for (const col of collections) {
        if (!col?.path) continue;

        try {
          await fetchCollectionItemsFromPath(
            col.path,
            col.maxPages || 5,
            col.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
            opts
          );
        } catch (_) {}
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runner, { timeout: 2500 });
    } else {
      setTimeout(runner, 800);
    }
  }
    
  // ════════════════════════════════════════════════════════════════
  // DÉMARRAGE
  // ════════════════════════════════════════════════════════════════

  const runnerEntries = CONFIGS
    .map(CFG => ({ CFG, runner: createRunner(CFG) }))
    .filter(entry => entry.runner);

  let IS_STARTING = false;
  let LAST_PATHNAME = '';

  function startSequentially() {
    runnerEntries.forEach(entry => {
      startRunnerWhenNearTarget(entry.runner, entry.CFG);
    });
    syncBodyRelatedBlockClasses();
  }

  function startOnce() {
    const pathname = location.pathname || '';

    if (IS_STARTING && pathname === LAST_PATHNAME) return;

    IS_STARTING = true;
    LAST_PATHNAME = pathname;

    try {
      runSharedCollections();
      startSequentially();
      runPreloadQueue();
    } finally {
      window.setTimeout(function() {
        IS_STARTING = false;
      }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startOnce, { once: true });
  } else {
    startOnce();
  }

  document.addEventListener('turbolinks:load', startOnce);
})();
