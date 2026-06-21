# ============================================================
# add_english.py — 기존 데이터에 english 필드 보충
# ------------------------------------------------------------
# 사용
#   python tools/add_english.py --lang es --all
#   python tools/add_english.py --lang es --type categories
#
# 한 파일씩 — Gemini에 그 파일의 모든 items(foreign+korean)를 보내
# english 배열을 받아 매칭해 저장. items 순서는 그대로 유지.
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
from google import genai  # noqa: E402
from google.genai import types  # noqa: E402

ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

LANG_NATIVE = {"en": "English", "es": "Español", "ja": "日本語", "fr": "Français", "zh": "中文"}


def build_prompt(lang: str, items: list) -> str:
    native = LANG_NATIVE.get(lang, lang)
    pairs = [
        f"{i}. {it.get('foreign','')} — 한국어: {it.get('korean','')}"
        for i, it in enumerate(items)
    ]
    return f"""아래 {native} 항목들에 대응하는 자연스러운 영어 표현을 만들어라.
한국인 학습자가 영어를 보조 레퍼런스로 보는 용도다.

규칙
1. 순서대로 정확히 {len(items)}개
2. 직역 아니라 원어민이 실제 쓰는 자연스러운 영어
3. 회화 문장은 "..." 없이 깔끔하게
4. 단어는 가장 흔한 단어 1개 (대안 표기 X)

목록
{chr(10).join(pairs)}

출력 — 영어 표현만 순서대로 JSON 배열
["english 1", "english 2", ...]"""


def call_gemini(client, model: str, lang: str, items: list) -> list[str]:
    prompt = build_prompt(lang, items)
    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    raw = (resp.text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).rstrip("`").strip()
    s = raw.find("[")
    e = raw.rfind("]")
    if s == -1:
        raise ValueError("JSON 배열 못 찾음")
    arr = json.loads(raw[s:e + 1])
    if not isinstance(arr, list):
        raise ValueError("배열 아님")
    return arr


def fill_file(client, model: str, lang: str, path: Path, force: bool) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items", [])
    # 이미 english 필드가 충분히 채워져 있으면 건너뜀
    have = sum(1 for it in items if it.get("english"))
    if not force and have >= len(items):
        print(f"  · {path.name:24} 이미 채워짐 ({have}/{len(items)})")
        return False
    print(f"  · {path.name:24} 보충 중… ({have}/{len(items)} → 전체)", end=" ", flush=True)
    try:
        eng_list = call_gemini(client, model, lang, items)
    except Exception as e:
        print(f"실패 — {str(e)[:80]}")
        return False
    if len(eng_list) != len(items):
        print(f"경고 — 응답 {len(eng_list)}개, items {len(items)}개. 가능한 만큼만 채움.")
    for i, it in enumerate(items):
        if i < len(eng_list):
            it["english"] = eng_list[i]
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("✓")
    return True


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lang", required=True)
    p.add_argument("--type", choices=["categories", "travel"], help="비우면 둘 다")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--force", action="store_true", help="이미 채워진 것도 다시")
    p.add_argument("--sleep", type=float, default=1.5)
    args = p.parse_args()

    lang_dir = DATA_DIR / args.lang
    if not lang_dir.exists():
        print(f"폴더 없음 — {lang_dir}")
        return 1

    targets = []
    for kind in (["categories", "travel"] if not args.type else [args.type]):
        d = lang_dir / kind
        if not d.exists():
            continue
        targets += sorted(d.glob("*.json"))

    if not targets:
        print("대상 파일 없음")
        return 0

    print(f"[english] {args.lang} — {len(targets)}개 파일 보충 (model={args.model})")
    client = genai.Client(api_key=_load_api_key())

    ok = 0
    for i, path in enumerate(targets):
        if fill_file(client, args.model, args.lang, path, args.force):
            ok += 1
        if i < len(targets) - 1:
            time.sleep(args.sleep)

    print(f"\n[english] {args.lang} 완료 — 변경 {ok}/{len(targets)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
