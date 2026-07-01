/* ============================================================
 * category.js — 카테고리 상세 (필수 단어)
 * ------------------------------------------------------------
 *  vocab-roots 패턴 참고
 *   - 카드 접힘/펼침 — 헤드 클릭 시 body 토글
 *   - 헤더에 전역 속도 슬라이더
 *   - 각 카드에 🔊 🔁 (헤드 안, 접혀도 조작 가능)
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
const $rateSlider = document.getElementById("rateSlider");
const $rateValue = document.getElementById("rateValue");
const $flipBtn = document.getElementById("flipBtn");
const $flipLabel = document.getElementById("flipLabel");

const LS_FLIP = "lingua-pack-flip";

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

/* ----- 반전 토글 — 카드 헤드 원문/뜻 전환 ----- */
function applyFlip(flipped) {
  $area.classList.toggle("flipped", flipped);
  $flipBtn.classList.toggle("active", flipped);
  $flipLabel.textContent = flipped ? "뜻" : "원문";
  try { localStorage.setItem(LS_FLIP, flipped ? "1" : "0"); } catch {}
}
function bindFlipBtn() {
  const saved = (() => { try { return localStorage.getItem(LS_FLIP) === "1"; } catch { return false; } })();
  applyFlip(saved);
  $flipBtn.addEventListener("click", () => {
    const nowFlipped = !$area.classList.contains("flipped");
    applyFlip(nowFlipped);
  });
}

/* ----- 헤더 속도 슬라이더 ----- */
function bindHeaderRate() {
  const r = getRate();
  $rateSlider.value = String(r);
  $rateValue.textContent = `${r.toFixed(1)}x`;
  $rateSlider.addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    setRate(v);
    $rateValue.textContent = `${v.toFixed(1)}x`;
  });
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ----- 카드 이벤트 ----- */
function bindItemEvents() {
  $area.addEventListener("click", (e) => {
    // 🔊 재생 — 카드 접힘/펼침과 별개
    const playBtn = e.target.closest("[data-action='play']");
    if (playBtn) {
      e.stopPropagation();
      const idx = parseInt(playBtn.dataset.idx, 10);
      const item = _data.items[idx];
      const card = playBtn.closest(".item");
      const progEl = card.querySelector(".item-progress");
      playOnce({ text: item.foreign, ttsLang: _ttsLang, progressEl: progEl });
      return;
    }
    // 🔁 반복
    const repeatBtn = e.target.closest("[data-action='repeat']");
    if (repeatBtn) {
      e.stopPropagation();
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
      return;
    }
    // 헤드 클릭 — 접힘/펼침 토글
    const head = e.target.closest("[data-action='toggle']");
    if (!head) return;
    const card = head.closest(".item");
    const expanded = card.getAttribute("aria-expanded") === "true";
    card.setAttribute("aria-expanded", expanded ? "false" : "true");
  });
}

// sections 메타(이모지·순서 명시) + items 그룹핑
function groupBySection(items, sectionsMeta) {
  const groups = new Map();
  items.forEach((it, i) => {
    const key = it.section || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...it, _idx: i });
  });
  // sections 메타가 있으면 그 순서·이모지 사용
  if (Array.isArray(sectionsMeta) && sectionsMeta.length) {
    const meta = new Map(sectionsMeta.map((s) => [s.name, s]));
    // meta 순서대로, 그 뒤 meta에 없는 그룹 붙임
    const seen = new Set();
    const ordered = [];
    for (const s of sectionsMeta) {
      if (groups.has(s.name)) {
        ordered.push([s.name, groups.get(s.name), s.emoji || ""]);
        seen.add(s.name);
      }
    }
    for (const [name, list] of groups) {
      if (!seen.has(name)) ordered.push([name, list, ""]);
    }
    return ordered;
  }
  return [...groups.entries()].map(([n, l]) => [n, l, ""]);
}

function renderCardHtml(it, i) {
  return `
    <div class="item" aria-expanded="false" data-idx="${i}">
      <div class="item-head" data-action="toggle" role="button" tabindex="0">
        <span class="item-head-text">
          <span class="item-foreign-text">${esc(it.foreign)}</span>
          <span class="item-korean-head">${esc(it.korean)}${it.english ? `<span class="item-english-head">, ${esc(it.english)}</span>` : ""}</span>
        </span>
        <span class="item-actions">
          <button class="item-tts" type="button" data-action="play" data-idx="${i}" aria-label="발음 듣기">🔊</button>
          <button class="item-tts repeat-btn" type="button" data-action="repeat" data-idx="${i}" aria-label="반복 따라 말하기" title="반복 따라 말하기">🔁</button>
        </span>
      </div>
      <div class="item-progress"><div class="fill"></div></div>
      <div class="item-body">
        <div class="item-pron">
          ${it.pronKo ? `<span class="item-pron-ko">${renderPronKo(it.pronKo)}</span>` : ""}
          ${it.pronIpa ? `<span class="item-pron-ipa">${esc(it.pronIpa)}</span>` : ""}
        </div>
        <div class="item-meaning">
          <span class="item-korean">${esc(it.korean)}</span>${it.english ? `<span class="item-english">, ${esc(it.english)}</span>` : ""}
        </div>
        ${it.context ? `<div class="item-context">${esc(it.context)}</div>` : ""}
      </div>
    </div>
  `;
}

function renderList(items) {
  $area.className = "item-list";
  const groups = groupBySection(items, _data.sections);
  if (groups.length === 1 && groups[0][0] === "") {
    $area.innerHTML = items.map((it, i) => renderCardHtml(it, i)).join("");
  } else {
    // 섹션마다 다른 색상 (파스텔 팔레트 8종 순환)
    $area.innerHTML = groups.map(([sectionName, groupItems, emoji], gIdx) => `
      <section class="section-box" data-color="${gIdx % 8}">
        ${sectionName ? `
          <h2 class="section-header">
            ${emoji ? `<span class="section-emoji">${emoji}</span>` : ""}
            <span>${esc(sectionName)}</span>
          </h2>
        ` : ""}
        <div class="section-group">
          ${groupItems.map((it) => renderCardHtml(it, it._idx)).join("")}
        </div>
      </section>
    `).join("");
  }

  $area.querySelectorAll(".item-head").forEach((h) => {
    h.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        h.click();
      }
    });
  });
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
    bindHeaderRate();
    bindFlipBtn();
    const [langs, data] = await Promise.all([loadLanguages(), loadCategory(lang, id)]);
    const langMeta = langs.find((l) => l.id === lang);
    _ttsLang = langMeta?.ttsLang || "en-US";
    _data = data;
    _langs = langs;
    renderLangSelect();
    // 제목 앞에 데이터의 emoji 붙임 — 홈 타일과 시각 일관성
    const emoji = data.emoji ? `<span class="page-emoji" aria-hidden="true">${data.emoji}</span> ` : "";
    $title.innerHTML = `${emoji}${esc(data.name || "카테고리")}`;
    document.title = `${data.name} — ${langMeta?.name || lang}`;
    $loading.style.display = "none";
    render();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();

window.addEventListener("beforeunload", () => stopRepeat());
