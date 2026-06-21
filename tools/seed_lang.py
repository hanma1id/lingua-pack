# ============================================================
# seed_lang.py — 한 언어의 카테고리·회화를 Gemini로 일괄 생성
# ------------------------------------------------------------
# 사용 예
#   python tools/seed_lang.py --lang en --type categories --skip-existing
#   python tools/seed_lang.py --lang es --all
#
# 결과 — data/<lang>/categories/<id>.json · data/<lang>/travel/<id>.json
#       + data/<lang>/index.json 자동 갱신
# ============================================================

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent))
from gemini_client import _load_api_key, DEFAULT_MODEL  # noqa: E402
from data_plan import CATEGORIES, TRAVEL  # noqa: E402
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

LANG_META = {
    "en": ("English", "영어"),
    "es": ("Español", "스페인어"),
    "ja": ("日本語",   "일본어"),
    "fr": ("Français", "프랑스어"),
    "zh": ("中文",     "중국어"),
}

PRON_GUIDE = {
    "en": "예: hello → 헐**로**우  (강세 음절을 ** ... ** 로 감쌈, 장음은 ː)",
    "es": "예: hola → **오**라 ·  buenos días → **부**에노스 **디**아스  (스페인어는 강세 규칙 명확)",
    "ja": "예: こんにちは → 콘**니**치와ː · ありがとう → 아리**가**또ː  (장음은 ː)",
    "fr": "예: bonjour → 봉**주**ʁ · merci → 메ʁ**시**  (콧소리·강세 음절 ** **)",
    "zh": "예: 你好 nǐ hǎo → 니ˇ 하ˇ오 (성조 다이아크리틱 그대로, 강세는 따로 없음)",
}


def build_prompt(lang: str, kind: str, item: dict) -> str:
    native, name_ko = LANG_META[lang]
    type_ko = "필수 단어 카테고리" if kind == "categories" else "여행 회화 상황"
    return f"""너는 한국인 학습자를 위한 {name_ko}({native}) 어학 데이터 작성자다.

이 묶음은 — **{type_ko}** → **{item['name']}**  ({item['hint']})
목표 항목 수 — 정확히 {item['count']}개

스키마 (반드시 이대로, 다른 키 추가 X)
{{
  "id": "{item['id']}",
  "name": "{item['name']}",
  "lang": "{lang}",
  "emoji": "{item['emoji']}",
  "items": [
    {{
      "foreign":   "{native}로 된 단어 또는 문장",
      "pronIpa":   "/IPA/",                          // 슬래시 포함
      "pronKo":    "한글 발음 표기 (강세 ** **)",
      "korean":    "한국어 뜻",
      "example":   "{native} 짧은 예문 (단어형이면 생략 가능)",
      "exampleKo": "예문 한국어 번역 (있을 때)",
      "context":   "회화일 때만 — 어떤 상황에서 쓰는지 짧게"
    }}
  ]
}}

규칙
1. 회화면 example/exampleKo는 비우고 context 채움. 단어면 가능하면 example/exampleKo 추가, context는 비움.
2. 한글 발음 표기 — {PRON_GUIDE[lang]}
3. 한국 중·고등학생도 읽을 수 있게 자연스러운 한국어
4. 단어/문장은 일상에서 가장 자주 쓰는 것 우선, 학술적·고어 금지
5. items 정확히 {item['count']}개

코드 펜스 없이 JSON만."""


def call_gemini(client, model: str, lang: str, kind: str, item: dict) -> dict:
    prompt = build_prompt(lang, kind, item)
    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )
    raw = (resp.text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).rstrip("`").strip()
    s = raw.find("{"); e = raw.rfind("}")
    if s == -1:
        raise ValueError("JSON 못 찾음")
    data = json.loads(raw[s:e + 1])
    # 안전망 — id/name/lang/emoji 강제 덮어쓰기
    data["id"] = item["id"]
    data["name"] = item["name"]
    data["lang"] = lang
    data["emoji"] = item["emoji"]
    return data


def rebuild_index(lang: str) -> None:
    """카테고리·회화 파일을 스캔해 index.json 자동 갱신."""
    lang_dir = DATA_DIR / lang
    out = {"lang": lang, "categories": [], "travel": []}
    for kind, planlist, key in [
        ("categories", CATEGORIES, "categories"),
        ("travel",     TRAVEL,     "travel"),
    ]:
        for item in planlist:
            fp = lang_dir / kind / f"{item['id']}.json"
            if not fp.exists():
                continue
            data = json.loads(fp.read_text(encoding="utf-8"))
            out[key].append({
                "id":    item["id"],
                "name":  item["name"],
                "emoji": item["emoji"],
                "count": len(data.get("items", [])),
            })
    (lang_dir / "index.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"[index] {lang} 갱신 — cat {len(out['categories'])}개, travel {len(out['travel'])}개")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lang", required=True, choices=list(LANG_META.keys()))
    p.add_argument("--type", choices=["categories", "travel"], help="비우면 둘 다")
    p.add_argument("--id", help="특정 id만")
    p.add_argument("--all", action="store_true", help="해당 언어 categories+travel 전부")
    p.add_argument("--skip-existing", action="store_true", help="이미 있는 파일은 건너뜀")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--sleep", type=float, default=1.5)
    args = p.parse_args()

    if not args.all and not args.type and not args.id:
        p.error("--type, --id, --all 중 하나는 필요")

    lang_dir = DATA_DIR / args.lang
    (lang_dir / "categories").mkdir(parents=True, exist_ok=True)
    (lang_dir / "travel").mkdir(parents=True, exist_ok=True)

    plan = []
    if args.id:
        # id 1개 — categories와 travel 양쪽에서 찾음
        for kind, lst in [("categories", CATEGORIES), ("travel", TRAVEL)]:
            for it in lst:
                if it["id"] == args.id:
                    plan.append((kind, it))
    else:
        if args.all or args.type == "categories":
            plan += [("categories", it) for it in CATEGORIES]
        if args.all or args.type == "travel":
            plan += [("travel", it) for it in TRAVEL]

    if not plan:
        print("대상 없음")
        return 0

    # skip-existing
    if args.skip_existing:
        plan = [(k, it) for (k, it) in plan
                if not (lang_dir / k / f"{it['id']}.json").exists()]

    print(f"[seed] {args.lang} — {len(plan)}개 생성 예정 (model={args.model})")
    client = genai.Client(api_key=_load_api_key())

    ok = 0
    for i, (kind, item) in enumerate(plan):
        print(f"  · {kind}/{item['id']:18} 요청…", end=" ", flush=True)
        try:
            data = call_gemini(client, args.model, args.lang, kind, item)
        except Exception as e:
            print(f"실패 — {str(e)[:80]}")
            if i < len(plan) - 1:
                time.sleep(args.sleep)
            continue
        out_path = lang_dir / kind / f"{item['id']}.json"
        out_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        n = len(data.get("items", []))
        print(f"✓ ({n} items)")
        ok += 1
        if i < len(plan) - 1:
            time.sleep(args.sleep)

    print(f"\n[seed] {args.lang} 완료 — {ok}/{len(plan)}")
    rebuild_index(args.lang)
    return 0


if __name__ == "__main__":
    sys.exit(main())
