/* ============================================================
 * pron-render.js — 한글 발음 마크업 → HTML
 * ------------------------------------------------------------
 *  표기 규칙
 *   **xxx**  → 강세 음절 (굵게 + 주황)
 *   ː        → 장음 (그대로 표시, 작게)
 *   ˇ ˊ ˋ    → 중국어 성조 (그대로 표시, 외국어 표기엔 병음에)
 *  데이터 예시
 *   "헐**로**우"     — "로" 강세
 *   "**투**ː"        — "투" 강세, 길게
 *   "**식**스"       — "식" 강세
 * ============================================================ */

const ESC = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

/**
 * 한글 발음 마크업을 안전한 HTML로 변환
 * @param {string} text 예 "헐**로**우" 또는 "**투**ː"
 * @returns {string} HTML 문자열
 */
export function renderPronKo(text) {
  if (!text) return "";
  // 먼저 HTML 이스케이프
  let safe = esc(text);
  // **...** → <span class="stress">...</span>
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<span class="stress">$1</span>');
  return safe;
}
