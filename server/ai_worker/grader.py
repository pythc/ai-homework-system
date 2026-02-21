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


SYSTEM_PROMPT = """你是“作业AI批改引擎”。任务：基于题目快照（prompt/standardAnswer/rubric）、学生文字答案与最多4张图片，对“单个学生的一道题”生成结构化批改建议（供教师复核，不是最终成绩）。

【输入要点】
- rubric 含多个评分项，每项有 rubricItemKey / maxScore / criteria。
- options 含 minConfidence、returnStudentMarkdown、handwritingRecognition、gradingStrictness、customGuidance。

【输出硬性规则】
1) 仅输出一个可解析 JSON 对象；禁止 Markdown、解释、代码块、额外文本。
2) 顶层必须有 result；仅当 returnStudentMarkdown=true 时可额外输出 extracted.studentMarkdown。
3) result 必须包含：
   - comment: string（简短、客观、建议口吻）
   - confidence: number（0~1）
   - isUncertain: boolean
   - uncertaintyReasons: array（可空但字段必须存在）
   - items: array
   - totalScore: number
4) items 每项必须包含：
   - questionIndex（来自输入 question.questionIndex）
   - rubricItemKey（必须来自输入 rubric）
   - score（0~maxScore）
   - maxScore（必须等于该 rubric 的 maxScore）
   - reason（按 rubric 给分/扣分依据）
   - uncertaintyScore（0~1）
5) 分数约束：totalScore = Σ items.score。
6) 不清晰或证据不足时：保守给分 + 提高 uncertaintyScore，禁止臆造。

【标准 JSON 输出示例（字段名必须一致）】
{
  "result": {
    "comment": "建议总评",
    "confidence": 0.82,
    "isUncertain": false,
    "uncertaintyReasons": [],
    "items": [
      {
        "questionIndex": 1,
        "rubricItemKey": "R1",
        "score": 8,
        "maxScore": 10,
        "reason": "核心思路正确，个别步骤不完整",
        "uncertaintyScore": 0.2
      }
    ],
    "totalScore": 8
  },
  "extracted": {
    "studentMarkdown": "仅在 returnStudentMarkdown=true 时输出"
  }
}
说明：当 returnStudentMarkdown=false 时，不要输出 extracted 字段。

【存疑规则】
- 若 confidence < options.minConfidence：必须 isUncertain=true，且追加 code=LOW_CONFIDENCE。
- 若任一 item.uncertaintyScore >= 0.6：建议 isUncertain=true 并说明原因。
- 图片无法辨认/题号无法对应/关键信息缺失时，必须给出相应 uncertaintyReasons。

【可用 code】
UNREADABLE, JUMP_STEP, STEP_CONFLICT, FINAL_ANSWER_MISMATCH, MISSING_INFO, FORMAT_AMBIGUOUS, LOW_CONFIDENCE, NON_HANDWRITTEN

【判分原则（严格按 rubric）】
- 满足给分点：给足或高分；
- 部分满足：部分给分并写清扣分原因；
- 缺失/矛盾/不匹配/不清晰：扣分并标注原因。

【studentMarkdown（仅在开启时）】
- 只做转写，不改写为标准答案；
- 看不清写“[无法辨认]”。
"""

HANDWRITING_PROMPT_SUFFIX = """

========================
七、手写识别专项规则（仅在 handwritingRecognition=true 时启用）
========================
先判定作答主体是否手写：
- 若印刷体/机打/电子排版为主，或无法稳定判断是否手写，一律按“非手写”处理。
- 手写与印刷混合且关键解题过程以印刷体为主，也按“非手写”处理。

非手写时必须：
1) result.isUncertain=true；
2) uncertaintyReasons 追加 {"code":"NON_HANDWRITTEN","message":"检测到非手写内容，建议教师复核"}；
3) result.confidence <= 0.35；
4) result.comment 明确写出“检测到非手写内容，置信度已下调，需要教师复核”。
"""

STRICTNESS_RULE_MAP = {
    "LENIENT": """
- 当前档位：LENIENT（宽松，预计得分区间 80~100）。
- 小瑕疵轻扣分，优先看核心思路与关键结论。
""",
    "BALANCED": """
- 当前档位：BALANCED（均衡，预计得分区间 60~90）。
- 按 rubric 常规给分，兼顾结果正确性与过程完整性。
""",
    "STRICT": """
- 当前档位：STRICT（严格，预计得分区间 40~80）。
- 更强调步骤完整性与逻辑严谨性；缺关键步骤/论证不足时明显扣分。
""",
}

QUESTION_TYPE_PROMPT_MAP = {
    "SHORT_ANSWER": """
- 当前题型：SHORT_ANSWER（简答题）。
- 重点看核心概念是否准确、关键结论是否成立，允许表达简洁但不能缺失关键论点。
""",
    "ESSAY": """
- 当前题型：ESSAY（论述题）。
- 重点看结构完整性、论证连贯性与观点支撑，避免仅按关键词机械给分。
""",
    "CALCULATION": """
- 当前题型：CALCULATION（计算题）。
- 重点检查公式使用、计算步骤与结果一致性；步骤缺失需在 reason 中明确扣分依据。
""",
    "PROOF": """
- 当前题型：PROOF（证明题）。
- 重点检查逻辑链条是否闭合、前提是否正确引用、推导是否严谨；结论正确但推导不足需扣分。
""",
    "SINGLE_CHOICE": """
- 当前题型：SINGLE_CHOICE（单选题）。
- 若走到模型批改，只做保守复核；与标准答案不一致时应直接扣分并标记依据。
""",
    "MULTI_CHOICE": """
- 当前题型：MULTI_CHOICE（多选题）。
- 若走到模型批改，按“漏选/错选/全对”说明判定依据，不要臆造未给出的选项。
""",
    "FILL_BLANK": """
- 当前题型：FILL_BLANK（填空题）。
- 若走到模型批改，逐空比对答案并说明差异，无法辨认时提高不确定性。
""",
    "JUDGE": """
- 当前题型：JUDGE（判断题）。
- 若走到模型批改，严格按对/错判定，不要扩展与题意无关的解释。
""",
}

STRICTNESS_PROMPT_TEMPLATE = """

========================
八、评分严厉程度（gradingStrictness）
========================
{strictness_rules}
"""

QUESTION_TYPE_PROMPT_TEMPLATE = """

========================
十、题型补充规则（questionType）
========================
{type_rules}
"""

CUSTOM_GUIDANCE_PROMPT_TEMPLATE = """

========================
九、教师自定义批改偏好（必须优先遵循）
========================
{custom_guidance}

执行要求：
- 不得违反评分细则 rubric；
- 与 rubric 冲突时以 rubric 为准，并在 reason 说明依据。
"""


def normalize_grading_strictness(value: Optional[str]) -> str:
    if not value:
        return "BALANCED"
    normalized = str(value).strip().upper()
    if normalized in STRICTNESS_RULE_MAP:
        return normalized
    return "BALANCED"


def normalize_question_type(value: Optional[str]) -> str:
    if not value:
        return "SHORT_ANSWER"
    normalized = str(value).strip().upper()
    if normalized in QUESTION_TYPE_PROMPT_MAP:
        return normalized
    return "SHORT_ANSWER"


def build_system_prompt(
    handwriting_recognition: bool,
    grading_strictness: str = "BALANCED",
    custom_guidance: str = "",
    question_type: str = "SHORT_ANSWER",
) -> str:
    normalized_strictness = normalize_grading_strictness(grading_strictness)
    normalized_question_type = normalize_question_type(question_type)
    prompt = SYSTEM_PROMPT + STRICTNESS_PROMPT_TEMPLATE.format(
        strictness_rules=STRICTNESS_RULE_MAP[normalized_strictness].strip()
    )
    prompt += QUESTION_TYPE_PROMPT_TEMPLATE.format(
        type_rules=QUESTION_TYPE_PROMPT_MAP[normalized_question_type].strip()
    )
    trimmed_guidance = custom_guidance.strip()
    if trimmed_guidance:
        prompt += CUSTOM_GUIDANCE_PROMPT_TEMPLATE.format(
            custom_guidance=trimmed_guidance
        )
    if handwriting_recognition:
        prompt += HANDWRITING_PROMPT_SUFFIX
    return prompt


SYSTEM_PROMPT_VERSION = "v5"
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


def build_messages(
    json_text: str, image_data_urls: List[str], system_prompt: str
) -> List[Dict]:
    # Build multi-modal input for the Responses API.
    user_text = "json:\n" + json_text
    system_message = {
        "role": "system",
        "content": [{"type": "input_text", "text": system_prompt}],
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
        "questionType": question.get("questionType"),
        "questionSchema": question.get("questionSchema"),
        "gradingPolicy": question.get("gradingPolicy"),
        "prompt": question.get("prompt"),
        "standardAnswer": question.get("standardAnswer"),
        "rubric": question.get("rubric") or [],
    }


def extract_options_payload(json_payload: Dict) -> Dict:
    options = json_payload.get("options") or {}
    strictness = normalize_grading_strictness(options.get("gradingStrictness"))
    custom_guidance = str(options.get("customGuidance") or "").strip()
    if len(custom_guidance) > 2000:
        custom_guidance = custom_guidance[:2000]
    return {
        "returnStudentMarkdown": options.get("returnStudentMarkdown", False),
        "minConfidence": options.get("minConfidence", 0.75),
        "handwritingRecognition": options.get("handwritingRecognition", False),
        "gradingStrictness": strictness,
        "customGuidance": custom_guidance,
    }


def extract_student_payload(json_payload: Dict, question_payload: Dict) -> Dict:
    return {
        "submissionVersionId": json_payload.get("submissionVersionId"),
        "studentAnswerText": json_payload.get("studentAnswerText") or "",
        "questionIndex": question_payload.get("questionIndex"),
    }


def build_prefix_messages(
    question_payload: Dict, options_payload: Dict, system_prompt: str
) -> List[Dict]:
    payload = {
        "question": question_payload,
        "options": options_payload,
    }
    user_text = "q:\n" + json.dumps(payload, ensure_ascii=False)
    system_message = {
        "role": "system",
        "content": [{"type": "input_text", "text": system_prompt}],
    }
    user_message = {
        "role": "user",
        "content": [{"type": "input_text", "text": user_text}],
    }
    return [system_message, user_message]


def build_suffix_messages(
    student_payload: Dict, image_data_urls: List[str]
) -> List[Dict]:
    user_text = "s:\n" + json.dumps(student_payload, ensure_ascii=False)
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
    system_prompt: str,
) -> Optional[str]:
    global CACHE_AVAILABLE
    if not PREFIX_CACHE_ENABLED or not CACHE_AVAILABLE:
        return None
    cached = get_cached_prefix_id(cache_key)
    if cached:
        return cached

    prefix_messages = build_prefix_messages(
        question_payload, options_payload, system_prompt
    )
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
    model = args.model or os.getenv("ARK_MODEL", "doubao-seed-2-0-mini-260215")

    json_payload = load_json_payload(args.json)
    if not isinstance(json_payload, dict):
        json_payload = {}
    json_text = json.dumps(json_payload, ensure_ascii=False, separators=(",", ":"))
    question_payload = extract_question_payload(json_payload)
    options_payload = extract_options_payload(json_payload)
    student_payload = extract_student_payload(json_payload, question_payload)
    handwriting_recognition = bool(options_payload.get("handwritingRecognition"))
    grading_strictness = str(options_payload.get("gradingStrictness") or "BALANCED")
    custom_guidance = str(options_payload.get("customGuidance") or "")
    question_type = str(question_payload.get("questionType") or "SHORT_ANSWER")
    system_prompt = build_system_prompt(
        handwriting_recognition,
        grading_strictness,
        custom_guidance,
        question_type,
    )

    image_paths = args.image or []
    if len(image_paths) > 4:
        print("Too many images; provide up to 4.", file=sys.stderr)
        return 2
    image_data_urls = [encode_image_data_url(path) for path in image_paths]
    full_messages = build_messages(json_text, image_data_urls, system_prompt)

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
                system_prompt=system_prompt,
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
