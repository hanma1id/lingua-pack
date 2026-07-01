/* ============================================================
 * home.js — 메인 화면 (home.html?lang=en)
 * ------------------------------------------------------------
 *  - 헤더 우측 — 현재 언어 + 전환 버튼
 *  - 탭 2개 — 필수 단어 / 여행 회화
 *  - 각 탭에 그 언어의 카테고리/회화 타일 그리드
 * ============================================================ */

import {
  loadLanguages, loadLangIndex, loadAlphabet,
  registerServiceWorker, setLastLang,
} from "./data-loader.js";
import { speak, cancelSpeak } from "./tts.js";
import { renderPronKo } from "./pron-render.js";

registerServiceWorker();

const params = new URLSearchParams(location.search);
const lang = params.get("lang") || "en";
setLastLang(lang);

const $langSelect = document.getElementById("langSelect");
const $tabBar = document.getElementById("tabBar");
const $area = document.getElementById("contentArea");
const $loading = document.getElementById("loading");

// URL ?tab= 으로 돌아올 때 자동 활성 (카테고리/회화 상세에서 "← 목록으로")
const _urlTab = params.get("tab");
const _ALLOWED_TABS = ["alphabet", "essentials", "travel"];
let _tab = _ALLOWED_TABS.includes(_urlTab) ? _urlTab : "essentials";
let _index = null;
let _langs = [];
let _alphabet = null;
let _ttsLang = "es-ES";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderLangSelect() {
  // 영어는 학습 대상이 아니라 레퍼런스로만 — 드롭다운에서 제외
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
    setLastLang(newLang);
    // 같은 탭으로 이동 (?tab 유지)
    location.href = `home.html?lang=${encodeURIComponent(newLang)}&tab=${encodeURIComponent(_tab)}`;
  });
}

function renderTab() {
  cancelSpeak();
  if (_tab === "alphabet") { renderAlphabetTab(); return; }
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

async function renderAlphabetTab() {
  if (!_alphabet) {
    $area.innerHTML = `<div class="loading">불러오는 중…</div>`;
    try { _alphabet = await loadAlphabet(lang); }
    catch { $area.innerHTML = `<div class="empty">알파벳 데이터가 아직 없어요.</div>`; return; }
  }
  const sections = _alphabet.sections || [{ name: "알파벳", emoji: "🔤" }];
  const bySection = new Map(sections.map((s) => [s.name, []]));
  for (const it of _alphabet.letters || []) {
    const key = it.section || sections[0].name;
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(it);
  }
  const html = sections.map((sec, idx) => {
    const items = bySection.get(sec.name) || [];
    const cells = items.map((l, i) => `
      <button class="alpha-cell" data-char="${esc(l.char)}" data-name="${esc(l.name || l.char)}" type="button">
        <span class="alpha-char">${esc(l.char)}</span>
        <span class="alpha-pron">${renderPronKo(l.pronKo || "")}</span>
      </button>
    `).join("");
    return `
      <section class="section-box alpha-section" data-color="${idx % 8}">
        <div class="section-header"><span class="section-emoji">${sec.emoji || "🔤"}</span> ${esc(sec.name)}</div>
        <div class="alpha-grid">${cells}</div>
      </section>
    `;
  }).join("");
  $area.innerHTML = `
    <div class="section-title">눌러서 발음을 들어보세요</div>
    ${html}
  `;
  $area.querySelectorAll(".alpha-cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ch = btn.dataset.char;
      const nm = btn.dataset.name;
      const spoken = _ttsLang.startsWith("es") ? (nm || ch) : ch;
      speak(spoken, _ttsLang, { rate: 0.85 });
    });
  });
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
    const cur = langs.find((l) => l.id === lang);
    _ttsLang = cur?.ttsLang || _ttsLang;
    renderLangSelect();
    $loading.style.display = "none";
    renderTab();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();
