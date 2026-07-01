/* ============================================================
 * travel.js — 여행 회화 상세 (카테고리와 구조 동일)
 * ============================================================ */

import {
  loadLanguages, loadTravel,
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

let _data = null;
let _ttsLang = "en-US";
let _activeRepeatId = null;
let _langs = [];

$backBtn?.addEventListener("click", () => {
  stopRepeat();
  location.href = `home.html?lang=${encodeURIComponent(lang)}&tab=travel`;
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
    location.href = `home.html?lang=${encodeURIComponent(newLang)}&tab=travel`;
  });
}

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

function bindItemEvents() {
  $area.addEventListener("click", (e) => {
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
    const head = e.target.closest("[data-action='toggle']");
    if (!head) return;
    const card = head.closest(".item");
    const expanded = card.getAttribute("aria-expanded") === "true";
    card.setAttribute("aria-expanded", expanded ? "false" : "true");
  });
}

function renderList(items) {
  $area.className = "item-list";
  $area.innerHTML = items.map((it, i) => `
    <div class="item" aria-expanded="false" data-idx="${i}">
      <div class="item-head" data-action="toggle" role="button" tabindex="0">
        <span class="item-foreign-text">${esc(it.foreign)}</span>
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
  `).join("");

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
    <a class="footer-back-link" href="home.html?lang=${encodeURIComponent(lang)}&tab=travel">
      ← 회화 목록으로
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
    $loading.textContent = "회화가 지정되지 않았어요.";
    return;
  }
  try {
    bindItemEvents();
    bindHeaderRate();
    const [langs, data] = await Promise.all([loadLanguages(), loadTravel(lang, id)]);
    const langMeta = langs.find((l) => l.id === lang);
    _ttsLang = langMeta?.ttsLang || "en-US";
    _data = data;
    _langs = langs;
    renderLangSelect();
    const emoji = data.emoji ? `<span class="page-emoji" aria-hidden="true">${data.emoji}</span> ` : "";
    $title.innerHTML = `${emoji}${esc(data.name || "여행 회화")}`;
    document.title = `${data.name} — ${langMeta?.name || lang}`;
    $loading.style.display = "none";
    render();
  } catch (err) {
    $loading.textContent = "데이터를 불러오지 못했어요.";
    console.error(err);
  }
})();

window.addEventListener("beforeunload", () => stopRepeat());
