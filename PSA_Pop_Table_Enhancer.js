// ==UserScript==
// @name         PSA Pop Table Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds PSA10% ratio column, color thresholds, sortable columns, and low-pop row hiding to PSA pop report pages.
// @author       You
// @match        https://www.psacard.com/pop/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ── Column indices (0-based td index in each row, hidden control col is 0) ──
    const COL_NUM   = 1;   // Card No.
    const COL_NAME  = 2;   // Name
    const COL_PSA10 = 15;  // PSA 10
    const COL_TOTAL = 16;  // Total

    // ── Thresholds ───────────────────────────────────────────────────────────────
    const THRESH_GREEN  = 30;   // < 30% green
    const THRESH_YELLOW = 50;   // 30–50% yellow, >50% red

    GM_addStyle(`
        /* ── Ratio badge ── */
        .psa-ratio {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
        }
        .psa-green  { background: #2f9e44; color: #fff; }
        .psa-yellow { background: #f59f00; color: #fff; }
        .psa-red    { background: #e03131; color: #fff; }
        .psa-na     { background: #dee2e6; color: #666; }

        /* ── Sortable header ── */
        th.psa-sortable {
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        th.psa-sortable:hover { background: #dce4ff !important; }
        th.psa-sortable .psa-sort-icon { margin-left: 4px; font-size: 10px; color: #888; }
        th.psa-sortable.asc  .psa-sort-icon::after { content: ' ▲'; color: #3b5bdb; }
        th.psa-sortable.desc .psa-sort-icon::after { content: ' ▼'; color: #3b5bdb; }
        th.psa-sortable.none .psa-sort-icon::after { content: ' ⇅'; }

        /* ── Ratio column header ── */
        th.psa-ratio-th {
            background: #e7f0ff !important;
            font-weight: 700 !important;
            white-space: nowrap;
        }
        td.psa-ratio-td {
            text-align: center;
            vertical-align: middle;
            padding: 4px 8px !important;
        }

    `);

    // ── Helpers ──────────────────────────────────────────────────────────────────
    function parseNum(el) {
        if (!el) return 0;
        // PSA cells have nested divs; first div is the main value
        const first = el.querySelector('div');
        const txt = (first ? first.textContent : el.textContent).replace(/,/g, '').trim();
        const n = parseInt(txt, 10);
        return isNaN(n) ? 0 : n;
    }

    function ratioClass(pct) {
        if (pct < THRESH_GREEN)  return 'psa-green';
        if (pct < THRESH_YELLOW) return 'psa-yellow';
        return 'psa-red';
    }

    function makeBadge(psa10, total) {
        const span = document.createElement('span');
        span.className = 'psa-ratio';
        if (total === 0) {
            span.classList.add('psa-na');
            span.textContent = 'N/A';
            span.dataset.pct = '-1';
        } else {
            const pct = (psa10 / total) * 100;
            span.classList.add(ratioClass(pct));
            span.textContent = pct.toFixed(1) + '%';
            span.dataset.pct = pct.toFixed(4);
            span.title = `PSA 10: ${psa10.toLocaleString()} / Total: ${total.toLocaleString()}`;
        }
        return span;
    }

    // ── Wait for table ────────────────────────────────────────────────────────────
    // ── Bootstrap ────────────────────────────────────────────────────────────────
    // We split init into two phases:
    //   Phase 1 (initHeader) — runs once: injects the ratio <th>, makes headers sortable
    //   Phase 2 (applyRatioToRows) — runs every time DataTables re-renders tbody rows
    //     (page-size change, sort, search) so the ratio column always stays populated.

    function rowHasData(tr) {
        const tds = tr.querySelectorAll('td');
        if (!tds.length) return false;
        const totalCell = tds[tds.length - 1];
        const firstDiv = totalCell.querySelector('div');
        const txt = (firstDiv || totalCell).textContent.replace(/,/g, '').trim();
        return /^\d+$/.test(txt);
    }

    function waitForFirstData(cb) {
        // Fire cb once when real data rows appear for the first time
        const obs = new MutationObserver(() => {
            const rows = document.querySelectorAll('table tbody tr:not(.bg-pale-blue)');
            if (rows.length >= 2 && rowHasData(rows[1])) {
                obs.disconnect();
                cb();
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }
     waitForFirstData(() => {
        const lengthSelect = document.querySelector('select[name="tablePSA_length"]');
        if (lengthSelect) {
            lengthSelect.value = '500';
            lengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        waitForFirstData(() => {
        const thresholdBar = document.createElement('div');
    thresholdBar.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:#f0f4ff;border:1px solid #c5d0f5;border-radius:8px;padding:8px 12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);';
    thresholdBar.innerHTML = `
        <label style="font-weight:600;color:#333;white-space:nowrap;">Min Total Pop:</label>
        <input id="psa-min-total" type="number" min="0" value="500"
            style="width:70px;padding:3px 7px;border:1px solid #bbb;border-radius:5px;font-size:13px;">
        <button id="psa-apply-threshold"
            style="padding:4px 12px;border-radius:5px;border:1px solid #3b5bdb;background:#3b5bdb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
            Apply
        </button>
    `;
    document.body.appendChild(thresholdBar);
    setTimeout(() => document.getElementById('psa-apply-threshold').click(), 500);

    document.getElementById('psa-apply-threshold').addEventListener('click', () => {
        const min = parseInt(document.getElementById('psa-min-total').value, 10) || 0;
        document.querySelectorAll('table tbody tr:not(.bg-pale-blue)').forEach(tr => {
            const ratioTd = tr.querySelector('td.psa-ratio-td');
            const total = ratioTd ? parseInt(ratioTd.dataset.total, 10) : 0;
            tr.style.display = total < min ? 'none' : '';
        });
    });
        init();          // sets up header + sorts, then calls applyRatioToRows()

        // Watch both thead and tbody — DataTables replaces both on page-size change
        const tableEl = document.querySelector('table');
        if (!tableEl) return;
        let debounce = null;
        const reapply = new MutationObserver(() => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                applyHeader();       // re-injects th + handlers if thead was replaced
                applyRatioToRows();  // re-injects ratio tds for new rows
            }, 120);
        });
        reapply.observe(tableEl, { childList: true, subtree: true });
        });
    });

    // ── Main init ─────────────────────────────────────────────────────────────────
    // ── Inject ratio <th> and wire sortable headers (re-runs if thead is replaced) ──
    function applyHeader() {
        const thead = document.querySelector('table thead tr');
        if (!thead) return;
        // Guard: skip if already enhanced and not replaced
        if (thead.dataset.psaEnhanced === '1') return;
        thead.dataset.psaEnhanced = '1';

        // Add ratio <th> after Total
        const ratioTh = document.createElement('th');
        ratioTh.className = 'psa-ratio-th psa-sortable none';
        ratioTh.innerHTML = 'PSA10 %<span class="psa-sort-icon"></span>';
        ratioTh.dataset.sortKey = 'pct';
        thead.appendChild(ratioTh);

        // Make existing key columns sortable
        const ths = thead.querySelectorAll('th');
        const sortableCols = [
            { idx: COL_NUM,   key: 'num',   th: ths[COL_NUM]   },
            { idx: COL_NAME,  key: 'name',  th: ths[COL_NAME]  },
            { idx: COL_PSA10, key: 'psa10', th: ths[COL_PSA10] },
            { idx: COL_TOTAL, key: 'total', th: ths[COL_TOTAL] },
        ];
        sortableCols.forEach(({ th, key }) => {
            if (!th) return;
            th.classList.add('psa-sortable', 'none');
            th.dataset.sortKey = key;
            const icon = document.createElement('span');
            icon.className = 'psa-sort-icon';
            th.appendChild(icon);
        });

        // Wire click handlers
        thead.querySelectorAll('th.psa-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                const dir = (currentSort.key === key && currentSort.dir === 'asc') ? 'desc' : 'asc';
                currentSort = { key, dir };

                thead.querySelectorAll('th.psa-sortable').forEach(t => {
                    t.classList.remove('asc', 'desc', 'none');
                    t.classList.add('none');
                });
                th.classList.remove('none');
                th.classList.add(dir);

                sortRows(key, dir);
            });
        });
    }

    // ── Apply / refresh ratio <td>s on all current tbody rows ──────────────────
    function applyRatioToRows() {
        const tbody = document.querySelector('table tbody');
        if (!tbody) return;
        const dataRows = Array.from(tbody.querySelectorAll('tr')).filter(tr =>
            !tr.classList.contains('bg-pale-blue')
        );

        dataRows.forEach(tr => {
            // Skip rows that already have a ratio td and whose data hasn't changed
            const existing = tr.querySelector('td.psa-ratio-td');
            const tds   = tr.querySelectorAll('td');
            const psa10 = parseNum(tds[COL_PSA10]);
            const total = parseNum(tds[COL_TOTAL]);

            if (existing) {
                // Row was re-rendered — check if values changed, update if so
                if (parseInt(existing.dataset.total) === total &&
                    parseInt(existing.dataset.psa10) === psa10) return;
                existing.remove();
            }

            if (!rowHasData(tr)) return; // skip rows still loading

            const td = document.createElement('td');
            td.className = 'psa-ratio-td';
            td.dataset.psa10 = psa10;
            td.dataset.total = total;

            const badge = makeBadge(psa10, total);
            td.dataset.pct = badge.dataset.pct;
            td.appendChild(badge);
            tr.appendChild(td);
            // ── eBay link: remove "Shop with Affiliates", make name a link ──
            const nameCell = tr.querySelector('td.text-left:nth-child(3)');
            if (nameCell && !nameCell.dataset.ebayDone) {
                nameCell.dataset.ebayDone = '1';

                // Remove the affiliate link
                const shopLink = nameCell.querySelector('a.shop-link');
                if (shopLink) shopLink.remove();

                // Build search term: name + variant + card number + "psa 10"
                const cardNum  = tr.querySelector('td.text-left:nth-child(2)')?.textContent.trim() || '';
                const nameEl   = nameCell.querySelector('strong');
                const cardName = nameEl ? nameEl.textContent.trim() : '';
                // Any text nodes after <strong> = variant (e.g. "Reverse Holo")
                const variant  = Array.from(nameCell.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE || (n.nodeName === 'BR' ? false : n !== nameEl))
                .map(n => n.textContent.trim()).join(' ').trim();
                const setTitle = (document.querySelector('h1')?.textContent.match(/EN-(.+)/) || [])[1]?.trim() || '';
                const query = encodeURIComponent(`${cardName} ${variant} ${cardNum} ${setTitle} psa 10`);
                const ebayUrl  = `https://www.ebay.com/sch/i.html?_nkw=${query}`;

                // Wrap the strong tag in a link
                const link = document.createElement('a');
                link.href = ebayUrl;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.style.cssText = 'color:#3b5bdb;text-decoration:none;font-weight:700;';
                link.style.fontWeight = ''; // let strong handle it
                nameEl.replaceWith(link);
                link.appendChild(nameEl);
            }
        });
    }

        function init() {
        const table = document.querySelector('table');
        if (!table) return;
        const thead = table.querySelector('thead tr');
        const tbody = table.querySelector('tbody');
        if (!thead || !tbody) return;

        // ── 1. Inject header and wire sorts
        applyHeader();
            setTimeout(() => {
                const th = document.querySelector('th.psa-ratio-th');
                th?.click();
                th?.click();
            }, 300);

        // ── 2. Initial ratio column population ─────────────────────────────────
        applyRatioToRows();

        // ── 3. Sort logic ───────────────────────────────────────────────────────
        let currentSort = { key: null, dir: 'none' };

        function sortRows(key, dir) {
            const rows = Array.from(tbody.querySelectorAll('tr')).filter(tr =>
                !tr.classList.contains('bg-pale-blue')
            );

            rows.sort((a, b) => {
                let av, bv;
                const aTds = a.querySelectorAll('td');
                const bTds = b.querySelectorAll('td');
                const aRatio = a.querySelector('td.psa-ratio-td');
                const bRatio = b.querySelector('td.psa-ratio-td');

                switch (key) {
                    case 'num':
                        av = parseInt(aTds[COL_NUM]?.textContent.trim(), 10) || 0;
                        bv = parseInt(bTds[COL_NUM]?.textContent.trim(), 10) || 0;
                        break;
                    case 'name':
                        av = aTds[COL_NAME]?.querySelector('strong')?.textContent.trim().toLowerCase() || '';
                        bv = bTds[COL_NAME]?.querySelector('strong')?.textContent.trim().toLowerCase() || '';
                        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
                    case 'psa10':
                        av = parseNum(aTds[COL_PSA10]);
                        bv = parseNum(bTds[COL_PSA10]);
                        break;
                    case 'total':
                        av = parseNum(aTds[COL_TOTAL]);
                        bv = parseNum(bTds[COL_TOTAL]);
                        break;
                    case 'pct':
                        av = parseFloat(aRatio?.dataset.pct ?? '-1');
                        bv = parseFloat(bRatio?.dataset.pct ?? '-1');
                        break;
                    default:
                        return 0;
                }
                return dir === 'asc' ? av - bv : bv - av;
            });

            // Re-append sorted rows (totals row stays pinned at top — re-insert after it)
            const totalsRow = tbody.querySelector('tr.bg-pale-blue');
            rows.forEach(tr => tbody.appendChild(tr));
            if (totalsRow) tbody.insertBefore(totalsRow, tbody.firstChild);

            // Re-stripe odd/even
            let visIdx = 0;
            rows.forEach(tr => {
                tr.classList.toggle('odd',  visIdx % 2 === 0);
                tr.classList.toggle('even', visIdx % 2 !== 0);
                visIdx++;
            });
        }

        document.querySelectorAll('th.psa-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sortKey;
                // 2-state toggle: desc -> asc -> desc ...
                const dir = (currentSort.key === key && currentSort.dir === 'desc') ? 'asc' : 'desc';
                currentSort = { key, dir };

                document.querySelectorAll('th.psa-sortable').forEach(t => {
                    t.classList.remove('asc', 'desc', 'none');
                    t.classList.add('none');
                });
                th.classList.remove('none');
                th.classList.add(dir);

                sortRows(key, dir);
            });
        });


    }

})();ipt==
// @name         PSA Pop Table Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds PSA10% ratio column, color thresholds, sortable columns, and low-pop row hiding to PSA pop report pages.
// @author       You
// @match        https://www.psacard.com/pop/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ── Column indices (0-based td index in each row, hidden control col is 0) ──
    const COL_NUM   = 1;   // Card No.
    const COL_NAME  = 2;   // Name
    const COL_PSA10 = 15;  // PSA 10
    const COL_TOTAL = 16;  // Total

    // ── Thresholds ───────────────────────────────────────────────────────────────
    const THRESH_GREEN  = 30;   // < 30% green
    const THRESH_YELLOW = 50;   // 30–50% yellow, >50% red

    GM_addStyle(`
        /* ── Ratio badge ── */
        .psa-ratio {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 700;
            white-space: nowrap;
        }
        .psa-green  { background: #2f9e44; color: #fff; }
        .psa-yellow { background: #f59f00; color: #fff; }
        .psa-red    { background: #e03131; color: #fff; }
        .psa-na     { background: #dee2e6; color: #666; }

        /* ── Sortable header ── */
        th.psa-sortable {
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
        }
        th.psa-sortable:hover { background: #dce4ff !important; }
        th.psa-sortable .psa-sort-icon { margin-left: 4px; font-size: 10px; color: #888; }
        th.psa-sortable.asc  .psa-sort-icon::after { content: ' ▲'; color: #3b5bdb; }
        th.psa-sortable.desc .psa-sort-icon::after { content: ' ▼'; color: #3b5bdb; }
        th.psa-sortable.none .psa-sort-icon::after { content: ' ⇅'; }

        /* ── Ratio column header ── */
        th.psa-ratio-th {
            background: #e7f0ff !important;
            font-weight: 700 !important;
            white-space: nowrap;
        }
        td.psa-ratio-td {
            text-align: center;
            vertical-align: middle;
            padding: 4px 8px !important;
        }

    `);
    // ── Helpers ──────────────────────────────────────────────────────────────────

})();
