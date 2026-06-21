/* ============================================================
 * category.js — 카테고리 상세 (필수 단어)
 * ------------------------------------------------------------
 *   - 두 보기 모드 — 리스트 / 플래시카드
 *   - 각 카드 — 🔊 단일 재생, 🔁 반복, 속도 따라 진행 바
 *   - 헤더 — 속도 칩 (0.6 / 0.8 / 1.0)
 *   - 하단 — 카테고리 목록으로 돌아가는 버튼
 * ============================================================ */

import {
  loadLanguages, loadCategory,
  registerServiceWorker,
} from "./data-loader.js";
import { renderPronKo } from "./pron-render.js";
import { createFlashcard } from "./flashcard.js";
import {
  getRate, setRate, startRepeat, stopRepeat, playOnce,
} from "./practice.js";

registerServiceWorker();

const params = new URLSearchParams(location.search);
const lang = params.get("lang") || "en";
const id   = params.get("id");

const $title = document.getElementById("pageTitle");
const $modeBar = document.getElementById("modeBar");
const $rateBar = document.getElementById("rateBar");
const $area = document.getElementById("contentArea");
const $loading = document.getElementById("loading");
const $footer = document.getElementById("footerArea");

let _mode = "list";
let _data = null;
let _ttsLang = "en-US";
let _activeRepeatId = null;  // 어떤 카드에서 반복 중인지 (data-action 식별용)

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ----- 속도 칩 ----- */
function syncRateBar() {
  const r = getRate();
  $rateBar.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", Math.abs(parseFloat(b.dataset.rate) - r) < 0.01);
  });
}

function bindRateBar() {
  $rateBar.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rate]");
    if (!b) return;
    setRate(parseFloat(b.dataset.rate));
    syncRateBar();
  });
  document.addEventListener("rate-changed", syncRateBar);
}

/* ----- 카드 컨트롤 동작 ----- */
function bindItemEvents() {
  $area.addEventListener("click", (e) => {
    const playBtn = e.target.closest("[data-action='play']");
    if (playBtn) {
      const idx = parseInt(playBtn.dataset.idx, 10);
      const item = _data.items[idx];
      const card = playBtn.closest(".item");
      const progEl = card.querySelector(".item-progress");
      // 같은 항목 반복 중이면 그것만 중단, 아니면 단일 재생
      if (_activeRepeatId === `r-${idx}`) {
        // 단일 재생은 반복과 별개로 처리 X — 그냥 다시 발화
        playOnce({ text: item.foreign, ttsLang: _ttsLang, progressEl: progEl });
      } else {
        playOnce({ text: item.foreign, ttsLang: _ttsLang, progressEl: progEl });
      }
      return;
    }
    const repeatBtn = e.target.closest("[data-action='repeat']");
    if (repeatBtn) {
      const idx = parseInt(repeatBtn.dataset.idx, 10);
      const item = _data.items[idx];
      const card = repeatBtn.closest(".item");
      const progEl = card.querySelector(".item-progress");
      // 이미 이 카드에서 반복 중이면 토글 — 끄기
      if (_activeRepeatId === `r-${idx}`) {
        stopRepeat();
        _activeRepeatId = null;
        // UI — 이전 활성 버튼 비활성화
        $area.querySelectorAll(".repeat-on").forEach((el) => el.classList.remove("repeat-on"));
        return;
      }
      // 다른 곳에서 반복 중이면 그쪽 표시 끄고 새 곳 켜기
      $area.querySelectorAll(".repeat-on").forEach((el) => el.classList.remove("repeat-on"));
      _activeRepeatId = `r-${idx}`;
      repeatBtn.classList.add("repeat-on");
      startRepeat({
        text: item.foreign,
        ttsLang: _ttsLang,
        progressEl: progEl,
      });
    }
  });
}

function renderList(items) {
  $area.className = "item-list";
  $area.innerHTML = items.map((it, i) => `
    <div class="item" data-idx="${i}">
      <div class="item-foreign">
        ${esc(it.foreign)}
        <span class="item-actions">
          <button class="item-tts" type="button" data-action="play" data-idx="${i}" aria-label="발음 듣기">🔊</button>
          <button class="item-tts repeat-btn" type="button" data-action="repeat" data-idx="${i}" aria-label="반복 따라 말하기" title="반복 따라 말하기">🔁</button>
        </span>
      </div>
      <div class="item-progress"><div class="fill"></div></div>
      <div class="item-pron">
        ${it.pronIpa ? `<div class="item-pron-ipa">${esc(it.pronIpa)}</div>` : ""}
        ${it.pronKo ? `<div class="item-pron-ko">${renderPronKo(it.pronKo)}</div>` : ""}
      </div>
      <div class="item-korean">${esc(it.korean)}</div>
      ${it.context ? `<div class="item-context">${esc(it.context)}</div>` : ""}
    </div>
  `).join("");
}

function renderFooter() {
  $footer.innerHTML = `
    <a class="footer-back-link" href="home.html?lang=${encodeURIComponent(lang)}&tab=essentials">
      ← 카테고리 목록으로
    </a>
  `;
}

function render() {
  if (!_data) return;
  stopRepeat();
  _activeRepeatId = null;
  if (_mode === "list") {
    renderList(_data.items);
  } else {
    $area.className = "";
    createFlashcard({ container: $area, items: _data.items, ttsLang: _ttsLang });
  }
  renderFooter();
}

function bindModeBar() {
  $modeBar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-mode]");
    if (!btn) return;
    _mode = btn.dataset.mode;
    $modeBar.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    render();
  });
}

(async function main() {
  if (!id) {
    $loading.textContent = "카테고리가 지정되지 않았어요.";
    return;
  }
  try {
    bindModeBar();
    bindRateBar();
    bindItemEvents();
    syncRateBar();
    const [langs, data] = await Promise.all([loadLanguages(), loadCategory(lang, id)]);
    const langMeta = langs.find((l) => l.id === lang);
    _ttsLang = langMeta?.ttsLang || "en-US";
    _data = data;
    $title.textContent = data.name || "카테고리";
    document.title = `${data.name} — ${langMeta?.name || lang}`;
    $loading.style.display = "none";
    render();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();

// 페이지 떠날 때 반복 중단
window.addEventListener("beforeunload", () => stopRepeat());
