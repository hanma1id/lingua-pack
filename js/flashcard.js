/* ============================================================
 * flashcard.js — 좌우 스와이프 플래시카드 컴포넌트
 * ------------------------------------------------------------
 *  쓰는 곳에서 createFlashcard({container, items, lang, ttsLang, render})를 호출.
 *  - 카드 탭 → 앞면(외국어+발음) / 뒷면(한국어 뜻) 토글
 *  - 좌→우 스와이프: 이전 카드
 *  - 우→좌 스와이프: 다음 카드
 *  - 좌우 버튼 키보드 화살표도 동작
 *  - 진행 상태 (1 / 20) 표시
 * ============================================================ */

import { speak } from "./tts.js";
import { renderPronKo } from "./pron-render.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function createFlashcard({ container, items, ttsLang = "en-US" }) {
  if (!items || !items.length) {
    container.innerHTML = `<div class="empty">표시할 항목이 없습니다</div>`;
    return;
  }

  let idx = 0;

  container.innerHTML = `
    <div class="flash-stage">
      <div class="flash-card" id="flashCard"></div>
    </div>
    <div class="flash-controls">
      <button id="flashPrev" type="button">← 이전</button>
      <div class="flash-progress" id="flashProgress"></div>
      <button id="flashNext" type="button">다음 →</button>
    </div>
  `;

  const $card = container.querySelector("#flashCard");
  const $prog = container.querySelector("#flashProgress");
  const $prev = container.querySelector("#flashPrev");
  const $next = container.querySelector("#flashNext");

  function renderCard() {
    const it = items[idx];
    const pronKo = it.pronKo ? renderPronKo(it.pronKo) : "";
    const pronIpa = it.pronIpa ? esc(it.pronIpa) : "";
    $card.classList.remove("flipped", "swipe-left", "swipe-right");
    $card.innerHTML = `
      <div class="flash-front">
        <div class="flash-foreign">${esc(it.foreign)}</div>
        ${pronIpa ? `<div class="flash-pron-ipa">${pronIpa}</div>` : ""}
        ${pronKo ? `<div class="flash-pron-ko">${pronKo}</div>` : ""}
        <button class="flash-tts" type="button" data-action="tts" aria-label="발음 듣기">🔊</button>
      </div>
      <div class="flash-back">
        <div class="flash-korean">${esc(it.korean)}</div>
        ${it.context ? `<div class="flash-context">${esc(it.context)}</div>` : ""}
        <button class="flash-tts" type="button" data-action="tts" aria-label="발음 듣기">🔊</button>
      </div>
      <div class="flash-hint">카드 탭 — 뒤집기 · 좌우 스와이프 — 이전/다음</div>
    `;
    $prog.textContent = `${idx + 1} / ${items.length}`;
  }

  function go(delta) {
    const dir = delta > 0 ? "swipe-left" : "swipe-right";
    $card.classList.add(dir);
    setTimeout(() => {
      idx = (idx + delta + items.length) % items.length;
      renderCard();
    }, 250);
  }

  // 카드 자체 클릭/탭 — 뒤집기 (단, TTS 버튼은 제외)
  $card.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='tts']")) {
      speak(items[idx].foreign, ttsLang);
      return;
    }
    $card.classList.toggle("flipped");
  });

  // 좌우 버튼
  $prev.addEventListener("click", () => go(-1));
  $next.addEventListener("click", () => go(1));

  // 키보드 화살표
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); $card.classList.toggle("flipped"); }
  });

  // 터치 스와이프
  let touchStartX = 0, touchStartY = 0, touching = false;
  $card.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touching = true;
  }, { passive: true });
  $card.addEventListener("touchend", (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // 가로 50px 이상 + 세로 < 가로 면 스와이프
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    }
  });

  renderCard();
}
