# Lingua Pack — 다국어 회화·필수단어 PWA

여행 회화 + 카테고리별 필수 단어. 영어부터 시작해 5개 언어(영·스·일·불·중) 순차 추가.

## 폴더 구조

```
lingua-pack/
├─ index.html            언어 선택 (첫 화면)
├─ home.html             메인 (필수 단어 / 여행 회화 탭)
├─ category.html         카테고리 상세 (단어 목록 + 플래시카드)
├─ travel.html           회화 상세 (문장 목록 + 플래시카드)
├─ manifest.json         PWA 매니페스트
├─ service-worker.js     network-first 캐시
├─ css/style.css
├─ js/
│  ├─ lang-select.js     첫 화면
│  ├─ home.js            메인 탭
│  ├─ category.js        카테고리 상세
│  ├─ travel.js          회화 상세
│  ├─ data-loader.js     데이터 fetch + SW 등록 + 마지막 언어
│  ├─ tts.js             다국어 TTS (모바일 견고 버전)
│  ├─ pron-render.js     한글 발음 마크업 → HTML
│  └─ flashcard.js       좌우 스와이프 플래시카드
├─ data/
│  ├─ languages.json     5개 언어 메타
│  ├─ en/
│  │  ├─ index.json      카테고리·회화 목록
│  │  ├─ categories/numbers.json
│  │  └─ travel/airport.json
│  ├─ es/ ja/ fr/ zh/    (추후 추가)
└─ icons/
```

## 한글 발음 표기 규칙

- `**xxx**` — 강세 음절 (굵게 + 주황)
- `ː` — 장음
- `ˇ ˊ ˋ` — 중국어 성조

예시
- hello → `헐**로**우`
- two → `**투**ː`
- 你好 nǐ hǎo → `니ˇ 하ˇ오`

## 로컬 실행

```powershell
cd C:\Users\hideo\lingua-pack
python -m http.server 8000
```

→ http://localhost:8000

## 배포 (GitHub Pages)

```powershell
git add .
git commit -m "변경 내용"
git push
```
→ 1~2분 후 https://hanma1id.github.io/lingua-pack/ 갱신

## 데이터 추가하는 법

1. 새 카테고리는 `data/en/categories/<id>.json` 작성
2. 새 회화는 `data/en/travel/<id>.json` 작성
3. `data/en/index.json` 에 한 줄 추가
4. `service-worker.js` 의 `CACHE_VERSION` 날짜 변경
5. git push
