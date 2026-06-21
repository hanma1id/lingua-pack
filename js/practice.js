/* ============================================================
 * practice.js — 따라 말하기 연습 유틸
 * ------------------------------------------------------------
 *   - 발음 속도(전역) localStorage 저장
 *   - 반복 패턴 컨트롤러 — 발화 → 따라말 대기 → 발화 ...
 *   - 진행 바 애니메이션 (HTMLDivElement)
 *
 *   각 단어/문장 카드에서 createPracticeWidget() 호출 →
 *   {speakBtn, repeatBtn, progressEl, ttsLang, text} 받으면 동작.
 * ============================================================ */

import { speak, cancelSpeak } from "./tts.js";

const LS_RATE = "lingua-pack-rate";
const DEFAULT_RATE = 0.9;

export function getRate() {
  try {
    const v = parseFloat(localStorage.getItem(LS_RATE));
    return Number.isFinite(v) && v > 0.2 && v < 2 ? v : DEFAULT_RATE;
  } catch {
    return DEFAULT_RATE;
  }
}
export function setRate(r) {
  try { localStorage.setItem(LS_RATE, String(r)); } catch {}
  // 다른 컨트롤들도 동기화하라는 신호
  document.dispatchEvent(new CustomEvent("rate-changed", { detail: r }));
}

/* ----- 현재 활성 반복 — 한 번에 하나만 ----- */
let _activeController = null;

/**
 * 반복 모드 시작 — 카드에 widget 연결
 * @param {Object} cfg
 *   text       — 발화할 텍스트
 *   ttsLang    — 언어 코드
 *   progressEl — 진행 바 div (.fill 자식)
 *   onState    — (state) => void  state ∈ "speaking" | "listening" | "idle"
 * @returns 중단 함수
 */
export function startRepeat({ text, ttsLang, progressEl, onState }) {
  // 이전 반복 중단
  stopRepeat();
  let cancelled = false;
  let rafId = null;
  let waitTimer = null;

  const setProgress = (ratio, color) => {
    if (!progressEl) return;
    const fill = progressEl.querySelector(".fill");
    if (!fill) return;
    fill.style.width = (Math.max(0, Math.min(1, ratio)) * 100) + "%";
    if (color) fill.style.background = color;
  };

  const SPEAK_COLOR = "var(--accent)";
  const LISTEN_COLOR = "var(--warn)";

  const animateListen = (duration) => {
    const start = performance.now();
    const step = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      if (elapsed >= duration) {
        setProgress(1, LISTEN_COLOR);
        // 한 사이클 끝 — 다시 발화
        cycle();
        return;
      }
      setProgress(elapsed / duration, LISTEN_COLOR);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  };

  const animateSpeak = (estimatedMs) => {
    const start = performance.now();
    const step = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      if (elapsed >= estimatedMs) {
        setProgress(1, SPEAK_COLOR);
        return;
      }
      setProgress(elapsed / estimatedMs, SPEAK_COLOR);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  };

  const cycle = () => {
    if (cancelled) return;
    onState?.("speaking");
    setProgress(0, SPEAK_COLOR);
    // 글자 수 기반 추정 발화 시간 (실제 onend 오면 그 값 사용)
    const rate = getRate();
    const estimate = Math.max(800, text.length * 80 / rate);
    animateSpeak(estimate);

    speak(text, ttsLang, {
      rate,
      onEnd: (actualMs) => {
        if (cancelled) return;
        setProgress(1, SPEAK_COLOR);
        // 따라 말 대기 시간 = 실제 발화 시간 + 약간의 여유
        const waitMs = Math.max(actualMs, 800) + 400;
        onState?.("listening");
        setProgress(0, LISTEN_COLOR);
        animateListen(waitMs);
      },
      onError: () => {
        // 에러여도 대기 후 재시도 — 무한 루프 방지로 최소 800ms
        if (cancelled) return;
        const waitMs = 1500;
        onState?.("listening");
        setProgress(0, LISTEN_COLOR);
        animateListen(waitMs);
      },
    });
  };

  cycle();

  const stop = () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (waitTimer) clearTimeout(waitTimer);
    cancelSpeak();
    setProgress(0, SPEAK_COLOR);
    onState?.("idle");
  };

  _activeController = stop;
  return stop;
}

export function stopRepeat() {
  if (_activeController) {
    _activeController();
    _activeController = null;
  }
}

/**
 * 단일 재생 + 진행 바 (반복 없음)
 */
export function playOnce({ text, ttsLang, progressEl }) {
  stopRepeat();
  if (!progressEl) {
    speak(text, ttsLang, { rate: getRate() });
    return;
  }
  const fill = progressEl.querySelector(".fill");
  let rafId = null;
  let cancelled = false;
  const setProgress = (r) => {
    if (fill) fill.style.width = (r * 100) + "%";
  };
  fill.style.background = "var(--accent)";

  const rate = getRate();
  const estimate = Math.max(800, text.length * 80 / rate);
  const start = performance.now();
  const step = () => {
    if (cancelled) return;
    const elapsed = performance.now() - start;
    if (elapsed >= estimate) {
      setProgress(1);
      return;
    }
    setProgress(elapsed / estimate);
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);

  speak(text, ttsLang, {
    rate,
    onEnd: () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      setProgress(1);
      // 잠시 후 진행 바 리셋
      setTimeout(() => setProgress(0), 800);
    },
    onError: () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      setProgress(0);
    },
  });
}
