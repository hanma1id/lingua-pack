/* ============================================================
 * home.js — 메인 화면 (home.html?lang=en)
 * ------------------------------------------------------------
 *  - 헤더 우측 — 현재 언어 + 전환 버튼
 *  - 탭 2개 — 필수 단어 / 여행 회화
 *  - 각 탭에 그 언어의 카테고리/회화 타일 그리드
 * ============================================================ */

import {
  loadLanguages, loadLangIndex,
  registerServiceWorker, setLastLang,
} from "./data-loader.js";

registerServiceWorker();

const params = new URLSearchParams(location.search);
const lang = params.get("lang") || "en";
setLastLang(lang);

const $headerLang = document.getElementById("headerLang");
const $tabBar = document.getElementById("tabBar");
const $area = document.getElementById("contentArea");
const $loading = document.getElementById("loading");

// URL ?tab= 으로 돌아올 때 자동 활성 (카테고리/회화 상세에서 "← 목록으로")
const _urlTab = params.get("tab");
let _tab = (_urlTab === "essentials" || _urlTab === "travel") ? _urlTab : "essentials";
let _index = null;
let _langs = [];

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHeaderLang() {
  const l = _langs.find((x) => x.id === lang);
  if (!l) return;
  $headerLang.innerHTML = `${l.flag} <span class="lang-name-mini">${esc(l.name)}</span>`;
}

function renderTab() {
  if (!_index) return;
  const list = _tab === "essentials" ? _index.categories : _index.travel;
  const targetPage = _tab === "essentials" ? "category.html" : "travel.html";

  if (!list || !list.length) {
    $area.innerHTML = `<div class="empty">아직 항목이 없어요. 곧 추가됩니다.</div>`;
    return;
  }

  const tiles = list.map((c) => `
    <a class="tile" href="${targetPage}?lang=${encodeURIComponent(lang)}&id=${encodeURIComponent(c.id)}">
      <span class="emoji">${c.emoji || "📘"}</span>
      <span class="name">${esc(c.name)}</span>
      <span class="count">${c.count}개</span>
    </a>
  `).join("");

  $area.innerHTML = `
    <div class="section-title">${_tab === "essentials" ? "카테고리를 골라 단어를 학습하세요" : "상황을 골라 회화를 익히세요"}</div>
    <div class="tile-grid">${tiles}</div>
  `;
}

function bindTabs() {
  $tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    _tab = btn.dataset.tab;
    $tabBar.querySelectorAll("button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    renderTab();
  });
}

function syncTabUi() {
  $tabBar.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === _tab)
  );
}

(async function main() {
  bindTabs();
  syncTabUi();
  try {
    const [langs, index] = await Promise.all([loadLanguages(), loadLangIndex(lang)]);
    _langs = langs;
    _index = index;
    renderHeaderLang();
    $loading.style.display = "none";
    renderTab();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();
