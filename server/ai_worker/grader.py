#!/usr/bin/env python3
import argparse
import base64
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Dict, List, Optional

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None


SYSTEM_PROMPT = """你是“作业AI批改引擎（AI Grading Engine）”。你将对“单个学生的一道题”进行批改：输入包含该题的题目/标准答案/评分细则 rubric，以及该学生该题的作业图片（≤4张，可能含手写文字、公式、图表）。你的输出会被后端直接保存并作为 AI Grading 展示给教师复核与采纳。

========================
一、任务目标
========================
基于学生作业图片与题目快照（prompt/answer/rubric），产出“结构化批改建议”：
- 给出分项评分 items（按 rubricItemKey 对齐）
- 给出建议性总评 comment
- 给出整体置信度 confidence（0~1）
- 给出是否存疑 isUncertain 及存疑原因 uncertaintyReasons（用于提示教师复核）
- 后端会自行计算/校验 totalScore（=items.score之和），但你仍需输出 totalScore

注意：你给出的是“建议分/建议评语”，不是最终成绩宣告；最终成绩由教师确认后落库。

========================
二、输入（由后端提供）
========================
你会收到一个 JSON（并同时收到最多4张学生作业图片作为多模态输入），结构大致为：

{
  "submissionVersionId": "…",
  "assignmentSnapshotId": "…",
  "studentAnswerText": "…学生作答文字（可为空）…",
  "question": {
    "questionIndex": 1,
    "prompt": "…题目…",
    "standardAnswer": "…标准答案或要点…",
    "rubric": [
      { "rubricItemKey": "R1", "maxScore": 10, "criteria": "…给分点/扣分点…" }
      // 可能有多条 rubric
    ]
  },
  "options": {
    "returnStudentMarkdown": false,
    "minConfidence": 0.75
  }
}

说明：
- rubricItemKey 是评分细则的稳定 key，你必须在 items 中返回相同 key。
- maxScore 以输入为准，不得擅自修改。
- 学生作业信息来自图片与 studentAnswerText；文字看不清时不要臆造。

========================
三、输出硬性要求（必须遵守）
========================
1) 你必须只输出“一个 JSON 对象”，禁止输出任何额外文本、解释、Markdown、代码块标记。
2) JSON 必须严格可解析：使用双引号、无注释、无多余逗号，不要输出 NaN/Infinity。
3) 顶层只能包含 result，及可选 extracted（仅当 returnStudentMarkdown=true 时）。
4) 输出结构必须完全符合下面的 schema；字段名必须一致。
5) 分数约束：
   - 每个 item.score 必须在 [0, item.maxScore] 内
   - totalScore 必须等于 Σ items.score（允许小数，但需合理；如 rubric 未说明，优先整数）
6) 存疑约束：
   - 若 confidence < options.minConfidence：必须 isUncertain=true，并追加一条 code=LOW_CONFIDENCE 的原因
   - 若任一 item.uncertaintyScore >= 0.6：建议 isUncertain=true，并在原因中指明 questionIndex
   - 图片无法辨认/题号无法确认/关键信息缺失：必须给出对应 code 与原因

========================
四、输出 JSON schema（必须严格遵循）
========================
{
  "result": {
    "comment": "string",                 // 总评：建议性、客观、简短
    "confidence": number,                // 0~1
    "isUncertain": boolean,              // 是否需要教师复核
    "uncertaintyReasons": [
      {
        "code": "UNREADABLE | JUMP_STEP | STEP_CONFLICT | FINAL_ANSWER_MISMATCH | MISSING_INFO | FORMAT_AMBIGUOUS | LOW_CONFIDENCE",
        "message": "string",
        "questionIndex": number          // 可选：能定位到题时再给
      }
    ],
    "items": [
      {
        "questionIndex": number,         // 来自输入 question.questionIndex
        "rubricItemKey": "string",       // 必须来自输入 rubricItemKey
        "score": number,                 // 该项得分
        "maxScore": number,              // 必须等于输入该 rubricItemKey 的 maxScore
        "reason": "string",              // 得分理由：对应 rubric 的给分点/扣分点
        "uncertaintyScore": number       // 0~1，越高越不确定
      }
    ],
    "totalScore": number                 // Σ items.score
  },
  "extracted": {
    "studentMarkdown": "string"          // 可选：仅当 options.returnStudentMarkdown=true 时输出
  }
}

规则：
- 如果 options.returnStudentMarkdown=false，则不要输出 extracted 字段（不要输出 null）。
- uncertaintyReasons 可以为空数组 []，但字段必须存在。

========================
五、批改与存疑判定指南
========================
1) 对齐 rubric 判分：
- 对 rubric 每一条分别判断学生是否满足 criteria：
  - 满足：给足分或大部分分
  - 部分满足/有小错：给部分分，并在 reason 写清扣分原因
  - 无法确认/看不清：保守给分，并提高 uncertaintyScore

2) code 触发建议：
- UNREADABLE：关键内容看不清/模糊/遮挡严重，无法可靠判分
- FORMAT_AMBIGUOUS：图片中题号/作答区域无法对应到该题，或答案位置不明
- MISSING_INFO：缺少关键结果/步骤/条件（题目要求但未给）
- JUMP_STEP：推导跳步导致无法确认正确性（缺关键等价变形/逻辑连接）
- STEP_CONFLICT：前后步骤明显矛盾（公式不一致、推导自相矛盾）
- FINAL_ANSWER_MISMATCH：最终答案与标准答案明显不一致且不可解释为等价
- LOW_CONFIDENCE：confidence < options.minConfidence（必须添加）

3) comment 写法（建议）：
- 先一句话概括完成度与主要问题
- 若 isUncertain=true：必须点出“需要复核的具体原因”（不要泛泛而谈）
- 避免“最终判定/盖章式结论”，用“建议/可能/需复核”等措辞

4) studentMarkdown（仅当开启且可靠）：
- 用 Markdown 转写学生作答；公式尽量用 LaTeX：行内 $...$，独立公式 $$...$$
- 看不清部分写“[无法辨认]”，不要臆造补全
- 转写不等于改写成标准答案

========================
六、重要提醒
========================
- 你只输出 JSON，不要输出任何接口、鉴权、URL、HTTP 方法等内容。
- 不要发散到与题目无关的教学讲解；reason/comment 只围绕判分点。
- 不要输出多套备选答案，只输出一份最终 JSON。
"""

SYSTEM_PROMPT_VERSION = "v1"
PREFIX_CACHE_ENABLED = (
    os.getenv("AI_GRADING_PREFIX_CACHE_ENABLED", "true").lower() != "false"
)
PREFIX_CACHE_TTL_SECONDS = int(
    os.getenv("AI_GRADING_PREFIX_CACHE_TTL_SECONDS", "604800")
)
CACHE_AVAILABLE = True
REDIS_URL = os.getenv("AI_GRADING_PREFIX_CACHE_REDIS_URL") or os.getenv(
    "REDIS_URL", ""
)
REDIS_KEY_PREFIX = os.getenv(
    "AI_GRADING_PREFIX_CACHE_KEY_PREFIX", "ai-grading:prefix:"
)
REDIS_AVAILABLE = True
_redis_client = None


def normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


class ApiError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status} error: {body}")
        self.status = status
        self.body = body


def load_json_payload(path: str) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_json_text(path: str) -> str:
    data = load_json_payload(path)
    return json.dumps(data, ensure_ascii=False, indent=2)


def get_redis_client():
    global _redis_client, REDIS_AVAILABLE
    if not REDIS_AVAILABLE or not REDIS_URL or redis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = redis.Redis.from_url(
                REDIS_URL, decode_responses=True
            )
        except Exception:
            REDIS_AVAILABLE = False
            return None
    return _redis_client


def build_prefix_cache_key(
    *, model: str, question_payload: Dict, options_payload: Dict
) -> str:
    payload = {
        "model": model,
        "system_prompt_version": SYSTEM_PROMPT_VERSION,
        "question": question_payload,
        "options": options_payload,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_prefix_id(cache_key: str) -> Optional[str]:
    client = get_redis_client()
    if not client:
        return None
    try:
        value = client.get(f"{REDIS_KEY_PREFIX}{cache_key}")
        if isinstance(value, str) and value:
            return value
    except Exception:
        return None
    return None


def set_cached_prefix_id(cache_key: str, response_id: str) -> None:
    client = get_redis_client()
    if not client:
        return
    try:
        client.set(
            f"{REDIS_KEY_PREFIX}{cache_key}",
            response_id,
            ex=PREFIX_CACHE_TTL_SECONDS if PREFIX_CACHE_TTL_SECONDS > 0 else None,
        )
    except Exception:
        return


def clear_cached_prefix_id(cache_key: str) -> None:
    client = get_redis_client()
    if not client:
        return
    try:
        client.delete(f"{REDIS_KEY_PREFIX}{cache_key}")
    except Exception:
        return


def guess_mime(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".jpg") or lower.endswith(".jpeg"):
        return "image/jpeg"
    if lower.endswith(".webp"):
        return "image/webp"
    return "application/octet-stream"


def encode_image_data_url(path: str) -> str:
    # Convert local image into a data URL that ARK accepts.
    with open(path, "rb") as f:
        raw = f.read()
    mime = guess_mime(path)
    b64 = base64.b64encode(raw).decode("ascii")
    return f"data:{mime};base64,{b64}"


def build_messages(json_text: str, image_data_urls: List[str]) -> List[Dict]:
    # Build multi-modal input for the Responses API.
    user_text = "输入 JSON：\n" + json_text
    system_message = {
        "role": "system",
        "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
    }
    user_content = []
    for image_url in image_data_urls:
        user_content.append({"type": "input_image", "image_url": image_url})
    user_content.append({"type": "input_text", "text": user_text})
    return [
        system_message,
        {"role": "user", "content": user_content},
    ]


def extract_question_payload(json_payload: Dict) -> Dict:
    question = json_payload.get("question") or {}
    return {
        "questionIndex": question.get("questionIndex"),
        "prompt": question.get("prompt"),
        "standardAnswer": question.get("standardAnswer"),
        "rubric": question.get("rubric") or [],
    }


def extract_options_payload(json_payload: Dict) -> Dict:
    options = json_payload.get("options") or {}
    return {
        "returnStudentMarkdown": options.get("returnStudentMarkdown", False),
        "minConfidence": options.get("minConfidence", 0.75),
    }


def extract_student_payload(json_payload: Dict, question_payload: Dict) -> Dict:
    return {
        "submissionVersionId": json_payload.get("submissionVersionId"),
        "studentAnswerText": json_payload.get("studentAnswerText") or "",
        "questionIndex": question_payload.get("questionIndex"),
    }


def build_prefix_messages(question_payload: Dict, options_payload: Dict) -> List[Dict]:
    payload = {
        "question": question_payload,
        "options": options_payload,
    }
    user_text = "题目与评分细则：\n" + json.dumps(payload, ensure_ascii=False)
    system_message = {
        "role": "system",
        "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
    }
    user_message = {
        "role": "user",
        "content": [{"type": "input_text", "text": user_text}],
    }
    return [system_message, user_message]


def build_suffix_messages(
    student_payload: Dict, image_data_urls: List[str]
) -> List[Dict]:
    user_text = "学生作答：\n" + json.dumps(student_payload, ensure_ascii=False)
    user_content = [{"type": "input_text", "text": user_text}]
    for image_url in image_data_urls:
        user_content.append({"type": "input_image", "image_url": image_url})
    return [{"role": "user", "content": user_content}]


def request_chat_completion(
    *, base_url: str, api_key: str, payload: Dict
) -> Dict:
    # Call ARK Responses endpoint with a single request payload.
    url = f"{base_url}/responses"
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read()
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise ApiError(exc.code, err_body) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Request failed: {exc}") from exc
    return json.loads(body.decode("utf-8"))


def should_fallback_cache_error(body: str) -> bool:
    text = (body or "").lower()
    if "cached response" in text:
        return True
    if "previous_response_id" in text:
        return True
    if "cache" in text and "invalidparameter" in text:
        return True
    if "cache" in text and "not consistent" in text:
        return True
    return False


def ensure_prefix_response_id(
    *,
    cache_key: str,
    base_url: str,
    api_key: str,
    model: str,
    question_payload: Dict,
    options_payload: Dict,
) -> Optional[str]:
    global CACHE_AVAILABLE
    if not PREFIX_CACHE_ENABLED or not CACHE_AVAILABLE:
        return None
    cached = get_cached_prefix_id(cache_key)
    if cached:
        return cached

    prefix_messages = build_prefix_messages(question_payload, options_payload)
    payload = {
        "model": model,
        "input": prefix_messages,
        "caching": {"type": "enabled", "prefix": True},
        "temperature": 0,
    }
    try:
        response = request_chat_completion(
            base_url=base_url, api_key=api_key, payload=payload
        )
    except ApiError as exc:
        if exc.status == 403 and "accessdenied.cacheservice" in exc.body.lower():
            CACHE_AVAILABLE = False
            print(
                "Cache service not enabled; fallback to no-cache.",
                file=sys.stderr,
            )
            return None
        raise

    response_id = response.get("id")
    if isinstance(response_id, str) and response_id:
        set_cached_prefix_id(cache_key, response_id)
        return response_id
    return None


def extract_content(response: Dict) -> str:
    # Handle both Responses-style output and legacy chat outputs.
    output = response.get("output")
    if isinstance(output, list):
        texts = []
        for item in output:
            if item.get("type") != "message":
                continue
            for content in item.get("content", []):
                if content.get("type") == "output_text":
                    text = content.get("text")
                    if text:
                        texts.append(text)
        if texts:
            return "\n".join(texts)
    output_text = response.get("output_text")
    if isinstance(output_text, str) and output_text:
        return output_text
    try:
        return response["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(
            f"Unexpected response format: {json.dumps(response, ensure_ascii=False)}"
        ) from exc


def validate_api_key(api_key: str) -> Optional[str]:
    # Guard against missing or placeholder keys.
    if not api_key.strip():
        return "Missing ARK_API_KEY in environment."
    try:
        api_key.encode("latin-1")
    except UnicodeEncodeError:
        return (
            "ARK_API_KEY contains non-ASCII characters. "
            "Replace the placeholder with your real key."
        )
    if "你的" in api_key or "API密钥" in api_key:
        return "ARK_API_KEY is still the placeholder. Replace it with your real key."
    return None


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send a JSON rubric + handwritten solution image to Doubao (ARK)."
    )
    parser.add_argument("--json", required=True, help="Path to the JSON input file.")
    parser.add_argument(
        "--image",
        action="append",
        default=[],
        help="Path to a handwritten solution image (repeat up to 4).",
    )
    parser.add_argument("--model", help="Model name override.")
    parser.add_argument("--base-url", help="API base URL override.")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, help="Optional max_tokens.")
    parser.add_argument("--out", help="Optional output file path.")
    args = parser.parse_args()

    api_key = os.getenv("ARK_API_KEY") or os.getenv("DEEPSEEK_API_KEY", "")
    key_error = validate_api_key(api_key)
    if key_error:
        print(key_error, file=sys.stderr)
        return 2

    base_url = normalize_base_url(
        args.base_url
        or os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
        or os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    )
    model = args.model or os.getenv("ARK_MODEL", "doubao-seed-1-8-251228")

    json_payload = load_json_payload(args.json)
    if not isinstance(json_payload, dict):
        json_payload = {}
    json_text = json.dumps(json_payload, ensure_ascii=False, indent=2)
    image_paths = args.image or []
    if len(image_paths) > 4:
        print("Too many images; provide up to 4.", file=sys.stderr)
        return 2
    image_data_urls = [encode_image_data_url(path) for path in image_paths]
    full_messages = build_messages(json_text, image_data_urls)

    question_payload = extract_question_payload(json_payload)
    options_payload = extract_options_payload(json_payload)
    student_payload = extract_student_payload(json_payload, question_payload)

    cache_key = None
    prefix_response_id = None
    has_question_content = any(
        [
            question_payload.get("prompt"),
            question_payload.get("standardAnswer"),
            question_payload.get("rubric"),
        ]
    )
    if has_question_content and PREFIX_CACHE_ENABLED:
        cache_key = build_prefix_cache_key(
            model=model,
            question_payload=question_payload,
            options_payload=options_payload,
        )
        try:
            prefix_response_id = ensure_prefix_response_id(
                cache_key=cache_key,
                base_url=base_url,
                api_key=api_key,
                model=model,
                question_payload=question_payload,
                options_payload=options_payload,
            )
        except ApiError as exc:
            raise RuntimeError(f"Prefix cache warmup failed: {exc.body}") from exc

    if prefix_response_id:
        suffix_messages = build_suffix_messages(student_payload, image_data_urls)
        payload = {
            "model": model,
            "input": suffix_messages,
            "temperature": args.temperature,
            "previous_response_id": prefix_response_id,
        }
        if CACHE_AVAILABLE:
            payload["caching"] = {"type": "enabled"}
    else:
        payload = {
            "model": model,
            "input": full_messages,
            "temperature": args.temperature,
        }

    if args.max_tokens:
        payload["max_output_tokens"] = args.max_tokens

    try:
        response = request_chat_completion(
            base_url=base_url, api_key=api_key, payload=payload
        )
    except ApiError as exc:
        if prefix_response_id and cache_key and should_fallback_cache_error(exc.body):
            clear_cached_prefix_id(cache_key)
            fallback_payload = {
                "model": model,
                "input": full_messages,
                "temperature": args.temperature,
            }
            if args.max_tokens:
                fallback_payload["max_output_tokens"] = args.max_tokens
            response = request_chat_completion(
                base_url=base_url, api_key=api_key, payload=fallback_payload
            )
        else:
            raise RuntimeError(f"Model call failed: {exc.body}") from exc
    content = extract_content(response)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(content)
            if not content.endswith("\n"):
                f.write("\n")
    else:
        print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
