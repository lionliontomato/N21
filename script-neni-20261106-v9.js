
(() => {
  'use strict';

  // 原站讀取規則：第一個非空 A 欄列為表頭，其下 A 欄有值才是資料。
  // 來源 A~I 九欄；P/Q 設定網站標題。
  // 搜尋支援 A 欄帳號、B 欄名字。

  const SHEET_ID = '1MVOvkG312ke-sExe_DCS-5qAd4qtSLDn513-7XPYeNo';
  const SHEET_GID = '0';
  const TABLE_COLS = 9;

  const REQUIRED_HEADERS = [
    null,
    null,
    '存歌數量🎵',
    '存爆數量🎵',
    '存鑽數量',
    '存圖數量',
    '存LOL數量',
    '存特戰數量',
    '更新時間'
  ];

  const ROW_WIDTH = 17; // A~Q
  const CONFIG_KEY = 15; // P 設定名稱
  const CONFIG_VALUE = 16; // Q 自由輸入文字
  const DEFAULT_TITLE = 'Neniの存鑽存歌';
  const DEFAULT_SUBTITLE = '';
  const REFRESH_MS = 30000;

  const fmt = new Intl.NumberFormat('zh-Hant-TW');
  const $ = id => document.getElementById(id);

  const clean = v =>
    String(v ?? '')
      .replace(/[\u200b-\u200d\u2060\ufeff]/gi, '')
      .trim();

  const lower = v =>
    clean(v).toLocaleLowerCase('zh-Hant-TW');

  const state = {
    headers: [],
    records: [],
    loaded: false,
    busy: false,
    request: 0,
    reloadWanted: false
  };

  const letter = i => String.fromCharCode(65 + i);

  function readCell(c) {
    return clean(
      c && c.f != null
        ? c.f
        : c && c.v != null
          ? c.v
          : ''
    );
  }

  function gvizToGrid(table) {
    if (!table || !Array.isArray(table.rows)) {
      throw new Error('Google 試算表回傳格式不正確');
    }

    const labels = Array.from(
      { length: ROW_WIDTH },
      (_, i) => clean(table.cols?.[i]?.label)
    );

    const rows = table.rows.map(row =>
      Array.from(
        { length: ROW_WIDTH },
        (_, i) => readCell(row?.c?.[i])
      )
    );

    return { rows, labels };
  }

  function csvToGrid(input) {
    const rows = [];
    let row = [];
    let cell = '';
    let quotes = false;

    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const next = input[i + 1];

      if (x === '"' && quotes && next === '"') {
        cell += '"';
        i++;
      } else if (x === '"') {
        quotes = !quotes;
      } else if (x === ',' && !quotes) {
        row.push(cell);
        cell = '';
      } else if (
        (x === '\n' || x === '\r') && !quotes
      ) {
        if (x === '\r' && next === '\n') i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += x;
      }
    }

    row.push(cell);
    rows.push(row);

    return {
      rows: rows.map(row =>
        Array.from(
          { length: ROW_WIDTH },
          (_, i) => clean(row[i])
        )
      ),
      labels: []
    };
  }

  function configType(k) {
    const key = lower(k).replace(
      /[\s：:（）()_\-]/g,
      ''
    );

    if ([
      '網站標題',
      '網頁標題',
      '主標題',
      '網站主標題',
      '網站大標題',
      '大標題',
      '網站名稱',
      'sitetitle',
      'maintitle',
      'title'
    ].includes(key)) {
      return 'title';
    }

    if ([
      '網站小標題',
      '網頁小標題',
      '小標題',
      '副標題',
      '網站副標題',
      '網頁副標題',
      'sitesubtitle',
      'subtitle'
    ].includes(key)) {
      return 'subtitle';
    }

    return null;
  }

  function extractTitles(rows) {
    const settings = new Map();

    rows.forEach(row => {
      const type = configType(row[CONFIG_KEY]);

      if (type) {
        settings.set(
          type,
          clean(row[CONFIG_VALUE])
        );
      }
    });

    return {
      title:
        settings.get('title') || DEFAULT_TITLE,
      subtitle:
        settings.has('subtitle')
          ? settings.get('subtitle')
          : DEFAULT_SUBTITLE
    };
  }

  function isGenericLabel(x, i) {
    return (
      !x ||
      /^(?:Col(?:umn)?\s*\d+|[A-Q])$/i.test(x) ||
      x === letter(i)
    );
  }

  function isLikelyHeader(row) {
    const a = lower(row[0]);
    const b = lower(row[1]);

    return (
      /^(?:存鑽老闆|名稱|姓名|暱稱|名字|帳號|會員|name|user|id|項目)$/.test(a) ||
      /^(?:存鑽數量|鑽石|存歌數量|數量|diamond|total)$/.test(b)
    );
  }

  function parseGrid({ rows, labels = [] }) {
    const headerAt = rows.findIndex(
      row => clean(row[0])
    );

    const actualLabels = Array.from(
      { length: TABLE_COLS },
      (_, i) => clean(labels[i])
    );

    const labelHeader =
      actualLabels.some(
        (v, i) => !isGenericLabel(v, i)
      ) &&
      (
        headerAt < 0 ||
        !isLikelyHeader(rows[headerAt])
      );

    const start = labelHeader
      ? Math.max(0, headerAt)
      : headerAt + 1;

    const hrow = labelHeader
      ? actualLabels
      : (rows[headerAt] || []);

    const headers = Array.from(
      { length: TABLE_COLS },
      (_, i) =>
        REQUIRED_HEADERS[i] ||
        clean(hrow[i]) ||
        (
          !isGenericLabel(actualLabels[i], i)
            ? actualLabels[i]
            : i === 0
              ? '帳號'
              : i === 1
                ? '名字'
                : ''
        )
    );

    const records = (
      headerAt < 0 && !labelHeader
        ? []
        : rows.slice(start)
    )
      .filter(row => clean(row[0]))
      .map(row =>
        Array.from(
          { length: TABLE_COLS },
          (_, i) => clean(row[i])
        )
      );

    return {
      headers,
      records,
      titles: extractTitles(rows)
    };
  }

  function formatValue(value, i) {
    if (i === 0) return value;

    if (
      /^[-+]?\d+(?:\.\d+)?$/.test(
        value.replace(/,/g, '')
      )
    ) {
      const numeric = Number(
        value.replace(/,/g, '')
      );

      if (
        Number.isFinite(numeric) &&
        !(/^0\d/.test(value))
      ) {
        return fmt.format(numeric);
      }
    }

    return value;
  }

  function setLinkOrText(td, value) {
    const url = /^https?:\/\/\S+$/i.test(value);

    if (url) {
      const link = document.createElement('a');
      link.href = value;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = value;
      td.append(link);
    } else {
      td.textContent = value;
    }
  }

  function renderHeaders(names) {
    const thead = $('tableHead');
    thead.replaceChildren();

    names.forEach((name, i) => {
      const th = document.createElement('th');
      th.scope = 'col';

      th.className = [
        'col-a',
        'col-b',
        'col-c',
        'col-d',
        'col-e',
        'col-f',
        'col-g',
        'col-h',
        'col-i'
      ][i];

      th.textContent = REQUIRED_HEADERS[i] || name;
      thead.append(th);
    });
  }

  // ====================================
  // 搜尋功能：同時搜尋帳號及名字
  // A 欄索引 0、B 欄索引 1
  // ====================================

  function matchSearch(row, keyword) {
    return (
      lower(row[0]).includes(keyword) ||
      lower(row[1]).includes(keyword)
    );
  }

  function render() {
    if (!state.loaded) return;

    const searchValue = $('searchInput').value;
    const keyword = lower(searchValue);

    const rows = keyword
      ? state.records.filter(
          row => matchSearch(row, keyword)
        )
      : state.records;

    const tbody = $('tableBody');
    tbody.replaceChildren();

    renderHeaders(state.headers);

    if (!rows.length) {
      const tr = document.createElement('tr');
      tr.className = 'empty-row';

      const td = document.createElement('td');
      td.colSpan = TABLE_COLS;

      td.textContent = keyword
        ? '目前沒有符合條件的資料'
        : '目前沒有可顯示的資料';

      tr.append(td);
      tbody.append(tr);
    } else {
      const fragment =
        document.createDocumentFragment();

      rows.forEach(row => {
        const tr = document.createElement('tr');

        row.forEach((v, i) => {
          const td = document.createElement('td');

          if (i === 0) {
            td.className = 'name-cell';
          }

          setLinkOrText(
            td,
            formatValue(v, i)
          );

          tr.append(td);
        });

        fragment.append(tr);
      });

      tbody.append(fragment);
    }

    $('resultText').textContent = keyword
      ? `搜尋「${clean(searchValue)}」：找到 ${rows.length} 筆資料。`
      : '';
  }

  function resetCopy() {
    $('siteTitle').textContent = '';
    $('siteSubtitle').textContent = '';

    document.title = 'Neniの存鑽存歌｜同步中';

    $('siteTitle').setAttribute(
      'aria-busy',
      'true'
    );
  }

  function showLoading(message) {
    resetCopy();

    renderHeaders([
      '帳號',
      '名字',
      ...REQUIRED_HEADERS.slice(2)
    ]);

    $('tableBody').replaceChildren();

    const tr = document.createElement('tr');
    tr.className = 'empty-row';

    const td = document.createElement('td');
    td.colSpan = TABLE_COLS;
    td.textContent = message;

    tr.append(td);
    $('tableBody').append(tr);

    $('resultText').textContent = message;
  }

  function loadJSONP() {
    return new Promise((resolve, reject) => {
      const cb =
        `__neniTO_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const tag = document.createElement('script');
      let done = false;

      const finish = () => {
        if (done) return false;

        done = true;
        clearTimeout(timer);
        delete window[cb];
        tag.remove();

        return true;
      };

      const timer = setTimeout(() => {
        if (finish()) {
          reject(
            new Error('試算表連線逾時')
          );
        }
      }, 18000);

      window[cb] = response => {
        if (!finish()) return;

        if (
          !response ||
          response.status === 'error'
        ) {
          return reject(
            new Error(
              response?.errors?.[0]?.message ||
              '試算表讀取錯誤'
            )
          );
        }

        try {
          resolve(
            gvizToGrid(response.table)
          );
        } catch (e) {
          reject(e);
        }
      };

      const u = new URL(
        `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`
      );

      u.searchParams.set('gid', SHEET_GID);
      u.searchParams.set('headers', '0');
      u.searchParams.set('tq', 'select *');
      u.searchParams.set(
        'tqx',
        `out:json;responseHandler:${cb}`
      );
      u.searchParams.set(
        '_',
        `${Date.now()}-${Math.random()}`
      );

      tag.src = u.href;

      tag.onerror = () => {
        if (finish()) {
          reject(
            new Error('無法連線 Google 試算表')
          );
        }
      };

      document.body.append(tag);
    });
  }

  async function loadCSV() {
    const urls = [
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}&headers=0&tqx=out:csv`,
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
    ];

    let last;

    for (const source of urls) {
      try {
        const url = new URL(source);

        url.searchParams.set(
          '_',
          `${Date.now()}-${Math.random()}`
        );

        const resp = await fetch(
          url.href,
          {
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'follow',
            headers: {
              'Accept': 'text/csv,text/plain,*/*'
            }
          }
        );

        if (!resp.ok) {
          throw new Error(
            `HTTP ${resp.status}`
          );
        }

        return csvToGrid(
          await resp.text()
        );
      } catch (e) {
        last = e;
      }
    }

    throw last ||
      new Error('試算表 CSV 讀取失敗');
  }

  async function load() {
    if (state.busy) {
      state.reloadWanted = true;
      return;
    }

    state.busy = true;

    const request = ++state.request;

    state.loaded = false;
    state.records = [];
    state.headers = [];

    showLoading('資料載入中…');

    try {
      let data;

      try {
        data = await loadCSV();
      } catch (e) {
        console.warn(
          'CSV 讀取失敗，改用 JSONP：',
          e
        );

        data = await loadJSONP();
      }

      if (
        request !== state.request ||
        state.reloadWanted ||
        document.hidden
      ) {
        return;
      }

      const parsed = parseGrid(data);

      state.headers = parsed.headers;
      state.records = parsed.records;
      state.loaded = true;

      $('siteTitle').textContent =
        parsed.titles.title;

      $('siteSubtitle').textContent =
        parsed.titles.subtitle;

      document.title = parsed.titles.title;

      $('siteTitle').removeAttribute(
        'aria-busy'
      );

      render();
    } catch (e) {
      if (
        request === state.request &&
        !state.reloadWanted &&
        !document.hidden
      ) {
        console.error(e);

        showLoading(
          '最新試算表資料讀取失敗，請確認分享權限與工作表 gid；不顯示舊資料。'
        );
      }
    } finally {
      if (request === state.request) {
        state.busy = false;

        if (state.reloadWanted) {
          state.reloadWanted = false;
          load();
        }
      }
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        $('searchInput').addEventListener(
          'input',
          render
        );

        $('clearBtn').addEventListener(
          'click',
          () => {
            $('searchInput').value = '';
            render();
            $('searchInput').focus();
          }
        );

        // 進入頁面時同步最新資料。
        showLoading('正在讀取最新資料…');
        load();

        // 每 30 秒同步一次。
        setInterval(() => {
          if (!document.hidden) {
            load();
          }
        }, REFRESH_MS);

        // 分頁切換後重新同步。
        document.addEventListener(
          'visibilitychange',
          () => {
            if (document.hidden) {
              showLoading(
                '重新開啟頁面時將同步最新資料…'
              );
            } else {
              load();
            }
          }
        );

        window.addEventListener(
          'pagehide',
          () => {
            showLoading(
              '重新開啟頁面時將同步最新資料…'
            );
          }
        );

        window.addEventListener(
          'pageshow',
          e => {
            if (e.persisted) {
              load();
            }
          }
        );

        // 清除舊版 Service Worker。
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker
            .getRegistrations()
            .then(regs => {
              const folder = new URL(
                './',
                location.href
              ).pathname;

              regs.forEach(reg => {
                try {
                  if (
                    new URL(reg.scope).pathname ===
                    folder
                  ) {
                    reg.unregister();
                  }
                } catch (_) {}
              });
            })
            .catch(() => {});
        }
      }
    );
  }

  if (
    typeof module !== 'undefined' &&
    module.exports
  ) {
    module.exports = {
      gvizToGrid,
      csvToGrid,
      parseGrid,
      extractTitles,
      isLikelyHeader,
      matchSearch,
      REQUIRED_HEADERS
    };
  }
})();
