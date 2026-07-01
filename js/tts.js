/* ============================================================
 * tts.js — 다국어 TTS (모바일 견고 + 잘못된 언어 방지)
 * ------------------------------------------------------------
 *  핵심
 *   - speak()는 반드시 동기 — async/await 끼면 모바일 차단
 *   - voice 정확 매칭 안 되면 speak 중단 (한국어로 스페인어 읽는 사고 방지)
 *   - 매칭 실패 시 화면 하단에 안내 배너 (한 언어당 한 번만)
 *   - iOS/안드로이드 잠금 해제는 첫 사용자 탭에서 무음 발화
 * ============================================================ */

const DEBUG = true;
const log = (...a) => DEBUG && console.log("[tts]", ...a);

let _voicesReady = false;
let _voicesCache = [];

function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return;
  _voicesReady = true;
  _voicesCache = voices;
  log("voices loaded:", voices.length,
      "langs:", [...new Set(voices.map(v => v.lang))].join(","));
}

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

/**
 * 언어 정확 매칭 — 한국어(ko) voice가 스페인어(es) 요청에 절대 매칭 안 되게
 *   voice.lang 정규화 필수 — 안드로이드는 es_ES, 표준은 es-ES
 *   1) 완전 매칭 (es-ES)
 *   2) 같은 primary 언어의 다른 region (es-MX, es-AR 등)
 *   3) 없으면 null — speak 실행 안 함
 */
function normLang(s) { return (s || "").toLowerCase().replace(/_/g, "-"); }

function pickVoice(ttsLang) {
  if (!_voicesReady) refreshVoices();
  if (!_voicesCache.length || !ttsLang) return null;

  const target = normLang(ttsLang);
  const primary = target.split("-")[0];

  const exact = _voicesCache.find(v => normLang(v.lang) === target);
  if (exact) return exact;

  const sameLang = _voicesCache.find(v => {
    const l = normLang(v.lang);
    return l === primary || l.startsWith(primary + "-");
  });
  return sameLang || null;
}

/* ----- voice 부재 안내 배너 (한 언어당 한 번만) ----- */
const _warnedLangs = new Set();
function warnMissingVoice(ttsLang) {
  if (_warnedLangs.has(ttsLang)) return;
  _warnedLangs.add(ttsLang);

  const primary = ttsLang.split("-")[0];
  const langNameMap = { es: "스페인어", ja: "일본어", fr: "프랑스어", zh: "중국어" };
  const langName = langNameMap[primary] || ttsLang;

  const banner = document.createElement("div");
  banner.className = "tts-warn-banner";
  banner.innerHTML = `
    <div class="tts-warn-inner">
      <div class="tts-warn-title">🔇 ${langName} 발음이 이 기기에 설치되어 있지 않아요</div>
      <div class="tts-warn-body">
        잘못된 발음(한국어로 읽음) 방지를 위해 재생을 건너뛰었어요.<br>
        <b>안드로이드</b> — 설정 → 일반 → 텍스트 음성 변환 → Google TTS → 언어 → ${langName} 설치<br>
        <b>iOS</b> — 설정 → 손쉬운 사용 → 콘텐츠 낭독 → 음성 → ${langName} 다운로드
      </div>
      <button class="tts-warn-close" type="button">닫기</button>
    </div>
  `;
  document.body.appendChild(banner);
  banner.querySelector(".tts-warn-close").addEventListener("click", () => banner.remove());
  setTimeout(() => banner.classList.add("visible"), 20);
}

/**
 * @param {string} text
 * @param {string} ttsLang  BCP-47 (es-ES, en-US, ja-JP …)
 * @param {object} opts     { rate?: number, onStart?, onEnd?(ms), onError? }
 */
export function speak(text, ttsLang = "en-US", opts = {}) {
  if (!("speechSynthesis" in window)) {
    log("speechSynthesis not supported");
    return;
  }
  if (!text) return;
  const synth = window.speechSynthesis;

  const voice = pickVoice(ttsLang);

  // voice가 없으면 잘못된 발음 방지를 위해 중단
  if (!voice) {
    log("no voice matching", ttsLang, "— aborting to avoid wrong-language playback");
    warnMissingVoice(ttsLang);
    opts.onError?.({ error: "no-voice", lang: ttsLang });
    return;
  }

  log("speak", text, ttsLang, "→", voice.name, "(" + voice.lang + ")");

  if (synth.speaking || synth.pending) {
    try { synth.cancel(); } catch (e) { log("cancel err", e); }
  }
  if (synth.paused) {
    try { synth.resume(); } catch (e) { log("resume err", e); }
  }

  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = opts.rate ?? 0.9;
  u.pitch = 1.0;
  u.volume = 1.0;

  const t0 = performance.now();
  u.onstart = () => { log("onstart", text); opts.onStart?.(); };
  u.onend = () => {
    const ms = performance.now() - t0;
    log("onend", text, Math.round(ms) + "ms");
    opts.onEnd?.(ms);
  };
  u.onerror = (e) => {
    log("onerror", text, e.error || e);
    opts.onError?.(e);
  };

  try {
    synth.speak(u);
  } catch (e) {
    log("speak threw", e);
    opts.onError?.(e);
  }
}

export function cancelSpeak() {
  if (!("speechSynthesis" in window)) return;
  try { window.speechSynthesis.cancel(); } catch (_) {}
}

/* iOS 잠금 해제 — 첫 사용자 탭에서 무음 발화 (기존 로직) */
let _unlocked = false;
function unlockOnce() {
  if (_unlocked || !("speechSynthesis" in window)) return;
  _unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    log("unlock fired");
  } catch (e) { log("unlock err", e); }
}
if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", unlockOnce, { once: true, passive: true });
  document.addEventListener("touchstart", unlockOnce, { once: true, passive: true });
  document.addEventListener("click", unlockOnce, { once: true });
}
