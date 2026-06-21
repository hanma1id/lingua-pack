/* ============================================================
 * category.js — 카테고리 상세 (필수 단어)
 * ------------------------------------------------------------
 *   - 리스트 모드만 (플래시카드 제거)
 *   - 각 카드 안에 속도 슬라이더 (0.4~1.0) — 전역 동기
 *   - 한국어 발음 + IPA를 한 줄에
 *   - 🔊 단일 재생 / 🔁 반복 따라말
 *   - 페이지 하단 "← 카테고리 목록으로"
 * ============================================================ */

import {
  loadLanguages, loadCategory,
  registerServiceWorker,
} from "./data-loader.js";
import { renderPronKo } from "./pron-render.js";
import {
  getRate, setRate, startRepeat, stopRepeat, playOnce,
} from "./practice.js";

registerServiceWorker();

const params = new URLSearchParams(location.search);
const lang = params.get("lang") || "es";
const id   = params.get("id");

const $title = document.getElementById("pageTitle");
const $area = document.getElementById("contentArea");
const $loading = document.getElementById("loading");
const $footer = document.getElementById("footerArea");
const $backBtn = document.getElementById("backBtn");
const $langSelect = document.getElementById("langSelect");

let _data = null;
let _ttsLang = "en-US";
let _activeRepeatId = null;
let _langs = [];

$backBtn?.addEventListener("click", () => {
  stopRepeat();
  location.href = `home.html?lang=${encodeURIComponent(lang)}&tab=essentials`;
});

function renderLangSelect() {
  const choices = _langs.filter((l) => l.id !== "en");
  $langSelect.innerHTML = choices.map((l) => {
    const label = `${l.flag} ${l.name}${l.ready ? "" : " (준비 중)"}`;
    const sel = l.id === lang ? " selected" : "";
    const dis = l.ready ? "" : " disabled";
    return `<option value="${l.id}"${sel}${dis}>${label}</option>`;
  }).join("");
  $langSelect.addEventListener("change", (e) => {
    const newLang = e.target.value;
    if (newLang === lang) return;
    stopRepeat();
    location.href = `home.html?lang=${encodeURIComponent(newLang)}&tab=essentials`;
  });
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ----- 카드 이벤트 ----- */
function bindItemEvents() {
  $area.addEventListener("click", (e) => {
    const playBtn = e.target.closest("[data-action='play']");
    if (playBtn) {
      const idx = parseInt(playBtn.dataset.idx, 10);
      const item = _data.items[idx];
      const card = playBtn.closest(".item");
      const progEl = card.querySelector(".item-progress");
      playOnce({ text: item.foreign, ttsLang: _ttsLang, progressEl: progEl });
      return;
    }
    const repeatBtn = e.target.closest("[data-action='repeat']");
    if (repeatBtn) {
      const idx = parseInt(repeatBtn.dataset.idx, 10);
      const item = _data.items[idx];
      const card = repeatBtn.closest(".item");
      const progEl = card.querySelector(".item-progress");
      if (_activeRepeatId === `r-${idx}`) {
        stopRepeat();
        _activeRepeatId = null;
        $area.querySelectorAll(".repeat-on").forEach((el) => el.classList.remove("repeat-on"));
        return;
      }
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

  // 카드 안 속도 슬라이더 — 한 곳 움직이면 모두 동기
  $area.addEventListener("input", (e) => {
    const sl = e.target.closest("input[data-action='rate-slider']");
    if (!sl) return;
    setRate(parseFloat(sl.value));
  });
  // 다른 슬라이더도 새 값으로 갱신
  document.addEventListener("rate-changed", (e) => {
    const r = e.detail;
    $area.querySelectorAll("input[data-action='rate-slider']").forEach((sl) => {
      sl.value = String(r);
      const lbl = sl.parentElement.querySelector(".rate-value");
      if (lbl) lbl.textContent = `${r.toFixed(1)}x`;
    });
  });
}

function renderList(items) {
  $area.className = "item-list";
  const r = getRate();
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
      <!-- 한국어 발음 + IPA 한 줄 -->
      <div class="item-pron">
        ${it.pronKo ? `<span class="item-pron-ko">${renderPronKo(it.pronKo)}</span>` : ""}
        ${it.pronIpa ? `<span class="item-pron-ipa">${esc(it.pronIpa)}</span>` : ""}
      </div>
      <!-- 한국어, 영어 한 줄 -->
      <div class="item-meaning">
        <span class="item-korean">${esc(it.korean)}</span>${it.english ? `<span class="item-english">, ${esc(it.english)}</span>` : ""}
      </div>
      ${it.context ? `<div class="item-context">${esc(it.context)}</div>` : ""}
      <!-- 속도 슬라이더 — 카드 안 -->
      <div class="item-rate">
        <span class="rate-label">속도</span>
        <input type="range" min="0.4" max="1.0" step="0.1" value="${r}" data-action="rate-slider" aria-label="발음 속도" />
        <span class="rate-value">${r.toFixed(1)}x</span>
      </div>
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
  renderList(_data.items);
  renderFooter();
}

(async function main() {
  if (!id) {
    $loading.textContent = "카테고리가 지정되지 않았어요.";
    return;
  }
  try {
    bindItemEvents();
    const [langs, data] = await Promise.all([loadLanguages(), loadCategory(lang, id)]);
    const langMeta = langs.find((l) => l.id === lang);
    _ttsLang = langMeta?.ttsLang || "en-US";
    _data = data;
    _langs = langs;
    renderLangSelect();
    $title.textContent = data.name || "카테고리";
    document.title = `${data.name} — ${langMeta?.name || lang}`;
    $loading.style.display = "none";
    render();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();

window.addEventListener("beforeunload", () => stopRepeat());
