/* ============================================================
 * tts.js — 다국어 TTS (모바일 견고 버전, lingua-pack)
 * ------------------------------------------------------------
 *  vocab-roots에서 검증된 패턴 그대로 + 언어 코드 가변
 *  핵심
 *   - speak()는 반드시 동기 — async/await 끼면 모바일 차단
 *   - voice는 모듈 로드 + onvoiceschanged + 호출 시점에 매번 갱신
 *   - 첫 사용자 탭에서 무음 발화로 잠금 해제
 *   - voice가 해당 언어로 없으면 lang만 지정 (브라우저 fallback)
 *   - 카카오톡 등 인앱 브라우저는 Web Speech API 거의 미지원
 * ============================================================ */

const DEBUG = true;
const log = (...a) => DEBUG && console.log("[tts]", ...a);

const _voiceCache = new Map();   // lang prefix → voice
let _voicesReady = false;

function refreshVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return;
  _voicesReady = true;
  _voiceCache.clear();
  // 가장 먼저 보이는 voice를 그 언어 prefix에 매핑
  for (const v of voices) {
    if (!v.lang) continue;
    const prefix2 = v.lang.slice(0, 2).toLowerCase();
    if (!_voiceCache.has(prefix2)) _voiceCache.set(prefix2, v);
    // 정확한 region 매칭 우선 — 예 en-US > en-GB
    if (/[-_](US|GB|ES|JP|FR|CN|TW|HK)$/i.test(v.lang) && !_voiceCache.has(v.lang)) {
      _voiceCache.set(v.lang.toLowerCase(), v);
    }
  }
}

if ("speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

function pickVoice(ttsLang) {
  if (!_voicesReady) refreshVoices();
  if (!ttsLang) return null;
  const exact = _voiceCache.get(ttsLang.toLowerCase());
  if (exact) return exact;
  const prefix2 = ttsLang.slice(0, 2).toLowerCase();
  return _voiceCache.get(prefix2) || null;
}

/**
 * @param {string} text 발음할 외국어 텍스트
 * @param {string} ttsLang "en-US" 같은 BCP-47 (없으면 영어)
 */
export function speak(text, ttsLang = "en-US") {
  if (!("speechSynthesis" in window)) {
    log("speechSynthesis not supported");
    return;
  }
  if (!text) return;
  const synth = window.speechSynthesis;

  const voice = pickVoice(ttsLang);
  log("speak", text, ttsLang, "voice:", voice?.name || "(default)");

  if (synth.speaking || synth.pending) {
    try { synth.cancel(); } catch (e) { log("cancel err", e); }
  }
  if (synth.paused) {
    try { synth.resume(); } catch (e) { log("resume err", e); }
  }

  const u = new SpeechSynthesisUtterance(text);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = ttsLang;
  }
  u.rate = 0.9;
  u.pitch = 1.0;
  u.volume = 1.0;
  u.onstart = () => log("onstart", text);
  u.onend   = () => log("onend", text);
  u.onerror = (e) => log("onerror", text, e.error || e);

  try {
    synth.speak(u);
  } catch (e) {
    log("speak threw", e);
  }
}

/* iOS/안드로이드 잠금 해제 — 첫 사용자 탭에서 무음 발화 한 번 */
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
