/* ============================================================
 * category.js — 카테고리 상세 (category.html?lang=en&id=numbers)
 * ------------------------------------------------------------
 *  - 두 가지 보기 모드 — 리스트 / 플래시카드
 *  - 리스트 — 모든 단어를 카드로 (외국어 + IPA + 한글발음 + 한국어 + 🔊)
 *  - 플래시카드 — 좌우 스와이프, 탭으로 뒤집기
 * ============================================================ */

import {
  loadLanguages, loadCategory,
  registerServiceWorker,
} from "./data-loader.js";
import { speak } from "./tts.js";
import { renderPronKo } from "./pron-render.js";
import { createFlashcard } from "./flashcard.js";

registerServiceWorker();

const params = new URLSearchParams(location.search);
const lang = params.get("lang") || "en";
const id   = params.get("id");

const $title = document.getElementById("pageTitle");
const $modeBar = document.getElementById("modeBar");
const $area = document.getElementById("contentArea");
const $loading = document.getElementById("loading");

let _mode = "list";   // "list" | "flash"
let _data = null;
let _ttsLang = "en-US";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderList(items) {
  $area.innerHTML = items.map((it) => `
    <div class="item">
      <div class="item-foreign">
        ${esc(it.foreign)}
        <button class="item-tts" type="button" data-action="tts" data-text="${esc(it.foreign)}" aria-label="발음 듣기">🔊</button>
      </div>
      <div class="item-pron">
        ${it.pronIpa ? `<div class="item-pron-ipa">${esc(it.pronIpa)}</div>` : ""}
        ${it.pronKo ? `<div class="item-pron-ko">${renderPronKo(it.pronKo)}</div>` : ""}
      </div>
      <div class="item-korean">${esc(it.korean)}</div>
      ${it.context ? `<div class="item-context">${esc(it.context)}</div>` : ""}
    </div>
  `).join("");

  $area.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='tts']");
    if (btn) speak(btn.dataset.text, _ttsLang);
  }, { once: false });
}

function render() {
  if (!_data) return;
  if (_mode === "list") {
    $area.className = "item-list";
    renderList(_data.items);
  } else {
    $area.className = "";
    createFlashcard({ container: $area, items: _data.items, ttsLang: _ttsLang });
  }
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
