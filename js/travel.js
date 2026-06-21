/* ============================================================
 * travel.js — 여행 회화 상세 (travel.html?lang=en&id=airport)
 * ------------------------------------------------------------
 *  카테고리와 구조 동일 — 데이터 로더와 페이지 제목만 다름
 * ============================================================ */

import {
  loadLanguages, loadTravel,
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

let _mode = "list";
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
  });
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
    $loading.textContent = "회화가 지정되지 않았어요.";
    return;
  }
  try {
    bindModeBar();
    const [langs, data] = await Promise.all([loadLanguages(), loadTravel(lang, id)]);
    const langMeta = langs.find((l) => l.id === lang);
    _ttsLang = langMeta?.ttsLang || "en-US";
    _data = data;
    $title.textContent = data.name || "여행 회화";
    document.title = `${data.name} — ${langMeta?.name || lang}`;
    $loading.style.display = "none";
    render();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();
