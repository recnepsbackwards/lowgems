// ==UserScript==
// @name         PSA Pop Ratio eBay
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Shows PSA grade/total ratio % on listing pages (all grades) and in the pop table dropdown.
// @author       You
// @match        https://www.ebay.com/itm/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        .psa-ratio-badge {
            display: inline-block;
            margin-left: 8px;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: 700;
            vertical-align: middle;
            letter-spacing: 0.02em;
        }
        .psa-ratio-green  { background: #2f9e44; color: #fff; }
        .psa-ratio-yellow { background: #f59f00; color: #fff; }
        .psa-ratio-red    { background: #e03131; color: #fff; }

        /* inline badges inside the pop table dropdown */
        .psa-kv-badge {
            display: inline-block;
            margin-left: 8px;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 700;
            vertical-align: middle;
        }
    `);

    function parseNum(str) {
        return parseInt((str || '').replace(/,/g, ''), 10) || 0;
    }

    function getRatioClass(pct) {
        if (pct < 30) return 'psa-ratio-green';
        if (pct < 50) return 'psa-ratio-yellow';
        return 'psa-ratio-red';
    }

    function makeBadge(gradeVal, totalVal, extraClass) {
        const span = document.createElement('span');
        span.className = `psa-ratio-badge ${extraClass || ''} ${getRatioClass((gradeVal / totalVal) * 100)}`;
        const pct = ((gradeVal / totalVal) * 100).toFixed(1);
        span.textContent = pct + '%';
        span.title = `${gradeVal.toLocaleString()} / ${totalVal.toLocaleString()} total`;
        return span;
    }

    // ── Part 1: elevated-info block on listing pages ──────────────────────────
    // Works for any grade (PSA 10, PSA 9, PSA 8, etc.)
    function injectElevatedInfo() {
        if (document.querySelector('.psa-ratio-badge')) return;

        const items = document.querySelectorAll('.elevated-info__item');
        let gradeVal   = null;
        let totalVal   = null;
        let gradeName  = '';
        let totalValueEl = null;

        items.forEach(item => {
            const label = item.querySelector('.elevated-info__item__label');
            const value = item.querySelector('.elevated-info__item__value');
            if (!label || !value) return;
            const labelText = label.textContent.trim();

            // Match any "PSA X pop" label e.g. "PSA 10 pop", "PSA 9 pop", "PSA 8 pop"
            const gradeMatch = labelText.match(/^PSA\s+([\d.]+)\s+pop$/i);
            if (gradeMatch) {
                gradeName = gradeMatch[1];
                gradeVal  = parseNum(value.textContent);
            }
            if (labelText === 'Total PSA pop') {
                totalVal     = parseNum(value.textContent);
                totalValueEl = value;
            }
        });

        if (!gradeVal || !totalVal || !totalValueEl) return;

        const isGrade10 = gradeName === '10';
        const badge = document.createElement('span');
        badge.className = 'psa-ratio-badge';

        if (isGrade10) {
            const pct = ((gradeVal / totalVal) * 100).toFixed(1);
            badge.classList.add(getRatioClass((gradeVal / totalVal) * 100));
            badge.textContent = pct + '%';
            badge.title = `PSA 10 pop (${gradeVal.toLocaleString()}) ÷ Total pop (${totalVal.toLocaleString()})`;
        } else {
            badge.style.cssText = 'background:#adb5bd;color:#fff;';
            badge.textContent = 'N/A';
            badge.title = 'Ratio only shown for PSA 10 listings';
        }

        totalValueEl.appendChild(badge);
    }

    // ── Part 2: psa-population-table dropdown (injected on click) ────────────
    function injectPopTable(popTable) {
        if (popTable.dataset.psaRatioDone) return;
        popTable.dataset.psaRatioDone = '1';

        // Sum all numeric grades for total (exclude Auth)
        const kvPairs = Array.from(popTable.querySelectorAll('.key-value'));
        let total = 0;
        kvPairs.forEach(kv => {
            const key = kv.querySelector('.key-value__key')?.textContent.trim();
            const val = parseNum(kv.querySelector('.key-value__value')?.textContent);
            if (key && key !== 'Auth' && !isNaN(parseFloat(key))) total += val;
        });

        if (!total) return;

        // Build cumulative map: for each grade, sum that grade + all grades above it
        const gradeEntries = kvPairs
        .map(kv => ({
            kv,
            key:    kv.querySelector('.key-value__key')?.textContent.trim(),
            valEl:  kv.querySelector('.key-value__value'),
            val:    parseNum(kv.querySelector('.key-value__value')?.textContent),
        }))
        .filter(e => e.key && e.key !== 'Auth' && !isNaN(parseFloat(e.key)));

        // Sort descending so we can accumulate from top grade down
        gradeEntries.sort((a, b) => parseFloat(b.key) - parseFloat(a.key));

        let cumulative = 0;
        gradeEntries.forEach(({ kv, key, valEl, val }) => {
            cumulative += val;
            if (!valEl || !val) return;
            if (valEl.querySelector('.psa-kv-badge')) return;
            const badge = makeBadge(cumulative, total, 'psa-kv-badge');
            badge.title = `PSA ${key}+: ${cumulative.toLocaleString()} / ${total.toLocaleString()} total`;
            valEl.appendChild(badge);
        });
    }

    // Watch for the pop table appearing anywhere in the DOM (injected on click)
    const popObserver = new MutationObserver(() => {
        document.querySelectorAll('.psa-population-table').forEach(el => {
            injectPopTable(el);
        });
    });
    popObserver.observe(document.body, { childList: true, subtree: true });

    // Run elevated-info injection on load + watch for SPA navigation
    injectElevatedInfo();
    const infoObserver = new MutationObserver(injectElevatedInfo);
    infoObserver.observe(document.body, { childList: true, subtree: true });

})();
