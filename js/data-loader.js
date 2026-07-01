/* ============================================================
 * data-loader.js — 데이터 fetch + 진도 + SW 등록
 * ------------------------------------------------------------
 *  - languages.json, 언어별 index.json, 카테고리/회화 상세 로드
 *  - 마지막 선택 언어 localStorage 저장
 *  - 즐겨찾기·진도는 추후 — 일단 lastLang만
 * ============================================================ */

const LS_LAST_LANG = "lingua-pack-last-lang";

const _cache = new Map();
async function _fetchJson(url) {
  if (_cache.has(url)) return _cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("불러오기 실패 — " + url);
  const data = await res.json();
  _cache.set(url, data);
  return data;
}

export const loadLanguages = () => _fetchJson("./data/languages.json");
export const loadLangIndex = (lang) => _fetchJson(`./data/${lang}/index.json`);
export const loadCategory  = (lang, id) => _fetchJson(`./data/${lang}/categories/${id}.json`);
export const loadTravel    = (lang, id) => _fetchJson(`./data/${lang}/travel/${id}.json`);
export const loadAlphabet  = (lang)     => _fetchJson(`./data/${lang}/alphabet.json`);

export function getLastLang() {
  try { return localStorage.getItem(LS_LAST_LANG); } catch { return null; }
}
export function setLastLang(lang) {
  try { localStorage.setItem(LS_LAST_LANG, lang); } catch {}
}

/* ----- 서비스 워커 — vocab-roots 패턴: 새 SW 활성화 시 자동 reload (한 번만) ----- */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;

  navigator.serviceWorker
    .register("./service-worker.js")
    .then((reg) => {
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "activated" && !sessionStorage.getItem("sw-reloaded")) {
            sessionStorage.setItem("sw-reloaded", "1");
            location.reload();
          }
        });
      });
    })
    .catch((err) => console.warn("SW 등록 실패", err));

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    sessionStorage.setItem("sw-reloaded", "1");
    location.reload();
  });
}
