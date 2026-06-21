/* ============================================================
 * lang-select.js — 언어 선택 첫 화면 (index.html)
 * ------------------------------------------------------------
 *  - 마지막 선택 언어 있으면 자동으로 home.html?lang=... 으로 redirect
 *  - 처음이면 5개 언어 카드 표시
 *  - ready=true인 언어만 활성, 나머지는 'Coming soon' 비활성
 * ============================================================ */

import { loadLanguages, getLastLang, setLastLang, registerServiceWorker } from "./data-loader.js";

registerServiceWorker();

const $grid = document.getElementById("langGrid");
const $loading = document.getElementById("loading");

// URL ?force=1 이면 자동 redirect 안 함 (언어 다시 고르고 싶을 때)
const force = new URLSearchParams(location.search).get("force");
const last = getLastLang();
// 영어는 학습 대상 아님 — 마지막 언어가 en이면 자동 진입 안 함
if (!force && last && last !== "en") {
  location.replace(`home.html?lang=${encodeURIComponent(last)}`);
}

function renderLanguages(langs) {
  // 영어는 학습 대상이 아니라 레퍼런스 — 첫 선택 화면에서 제외
  const visible = langs.filter((l) => l.id !== "en");
  $grid.innerHTML = visible.map((l) => {
    const cls = l.ready ? "lang-card" : "lang-card disabled";
    const href = l.ready ? `home.html?lang=${encodeURIComponent(l.id)}` : "#";
    const tag = l.ready
      ? `<span class="ready-tag ready">학습 가능</span>`
      : `<span class="ready-tag">Coming soon</span>`;
    return `
      <a class="${cls}" href="${href}" data-lang="${l.id}" data-ready="${l.ready}">
        <span class="flag">${l.flag}</span>
        <span class="name">${l.name}</span>
        <span class="native">${l.native}</span>
        ${tag}
      </a>
    `;
  }).join("");

  $grid.addEventListener("click", (e) => {
    const card = e.target.closest(".lang-card");
    if (!card) return;
    if (card.dataset.ready !== "true") {
      e.preventDefault();
      return;
    }
    setLastLang(card.dataset.lang);
  });
}

(async function main() {
  try {
    const langs = await loadLanguages();
    $loading.style.display = "none";
    renderLanguages(langs);
  } catch (err) {
    $loading.textContent = "언어 목록을 불러오지 못했어요.";
    console.error(err);
  }
})();
