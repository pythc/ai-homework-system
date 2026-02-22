import 'dotenv/config';
import express from 'express';

const {
  ASSISTANT_PORT = 4100,
  ASSISTANT_MODEL = 'doubao-seed-2-0-mini-260215',
  ASSISTANT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3',
  ASSISTANT_ASSET_BASE = 'http://localhost:3000',
  ARK_API_KEY = '',
  ASSISTANT_CACHE_TTL_MS = '1800000',
  ASSISTANT_MODEL_TIMEOUT_MS = '30000',
} = process.env;

if (!ARK_API_KEY) {
  console.warn('[assistant] ARK_API_KEY is not set.');
}

const app = express();
app.use(express.json({ limit: '50mb' }));

const normalizeBaseUrl = (url) => (url ? url.replace(/\/+$/, '') : '');
const baseUrl = normalizeBaseUrl(ASSISTANT_BASE_URL);
const responsesUrl = `${baseUrl}/responses`;

const cacheTtlMs = Number(ASSISTANT_CACHE_TTL_MS) || 30 * 60 * 1000;
const modelTimeoutMs = Number(ASSISTANT_MODEL_TIMEOUT_MS) || 30000;
const prefixCache = new Map();
let cacheAvailable = true;

const fetchWithTimeout = async (url, init, timeoutMs = modelTimeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      (error instanceof Error && error.name === 'AbortError') ||
      message.includes('aborted')
    ) {
      const timeoutError = new Error(`request timeout after ${timeoutMs}ms`);
      timeoutError.code = 'REQUEST_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const isTimeoutError = (error) => {
  if (!error) return false;
  const code = error?.code;
  if (code === 'REQUEST_TIMEOUT') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('timeout');
};

const fallbackAnswer = '请求超时，模型暂时繁忙，请稍后重试。';

const systemPrompt = `你是“AI作业分析助手”，服务于作业管理系统。
可用数据字段：
- 用户信息：scope.user
- 统计数据：stats（可能包含 count / avg / min / max / byAssignment）
- 元信息：stats.meta（可能包含 courses / assignments / students / counts）
- 访问范围：scope（role / courseId / assignmentId）

权限与范围规则：
- 学生：只能查看自己的课程/作业元信息与成绩统计；不提供其他学生名单
- 教师：可查看自己课程列表、课程内作业与学生名单（仅限自己课程范围）；若涉及学生名单且未指定 courseId，请提示先指定课程
- 管理员：不提供该功能（应礼貌说明暂不支持）
若问题超出 scope 或数据缺失/为空，必须明确说明“暂无数据/无权限/需要指定课程或作业”。
当用户问“我是谁/我的信息”时，直接使用 scope.user 返回，但要整理后再返回，避免暴露隐私字段。

输出要求：
- 默认中文
- 不输出其他学生的敏感信息（如邮箱/手机号），教师查询学生名单时仅展示必要字段（如姓名/学号）
- 第一次回答时要说“您好，xxx老师/同学”
- 语气友好且专业，可以适当使用表情符号和热情回应
- 如果用户提问到此系统的使用体验不好，你应该礼貌回答表示抱歉，并将管理员的信息（周灿宇，邮箱：2813994715@qq.com）贴出，方便用户反馈意见。
- 若提供了图片，请结合图片内容进行回答；不要说“无法查看图片”。
- 如果用户说“重要提醒！点我查看”，你应该回复“由于多轮对话成本较高，建议您尽量多开启新对话，而非在同一对话中反复提问。这样有助于大幅减少您的token用量，同时带来更好的体验。感谢您的理解与支持！”并附上一个友好的表情符号。

额外背景知识：
- 你是重庆邮电大学数学与统计学院110实验室的AI助手。由陈六新副院长和陈玮老师牵头、学院大力支持下，数统学院110实验室/社团成立于2025年3月8日，是学院内聚焦学科竞赛、编程指导的学生组织，现有成员共22人。实验室自成立以来始终聚焦人工智能、图像识别、前后端开发等领域，以“探索智能前沿，赋能创新实践”为宗旨，致力于搭建一个集学术交流、技术实践、项目孵化于一体的综合性平台。社团汇聚了学校文峰班、计算机科学与技术、智能科学与技术+数学与应用数学双学位等多个专业的优秀学生，其中不乏在人工智能算法、机器学习、深度学习等方向表现突出的专业人才。
- 实验室成员获得计算机领域竞赛奖项二十余项，并在全国大学生计算机设计大赛荣获全国二等奖
- 实验室重点推进两大核心建设目标：一是打造高质量算法人才培养基地，聚焦算法能力体系化培育；二是构建具备完整 IT 公司架构的实践平台，实现 “就业指导 + 项目产出” 双向赋能，既为成员提供贴合行业需求的职业指引，也通过真实项目实践提升技术落地能力。
`;

const buildUserContent = (question, stats, scope, images) => {
  const imageHint = Array.isArray(images) && images.length
    ? `\n\n图片数量：${images.length}\n图片文件名：${images
        .map((item) => item?.name)
        .filter(Boolean)
        .join('、')}`
    : '';
  return `问题：${question}${imageHint}\n\n用户信息：${JSON.stringify(
    scope?.user ?? {},
    null,
    2,
  )}\n\n统计数据：${JSON.stringify(stats, null, 2)}\n\n范围：${JSON.stringify(
    scope ?? {},
    null,
    2,
  )}`;
};

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .map((item) => ({
      name: item?.name,
      dataUrl: item?.dataUrl,
      url: item?.url,
    }))
    .filter((item) => {
      if (typeof item?.dataUrl === 'string' && item.dataUrl.startsWith('data:image')) {
        return true;
      }
      if (typeof item?.url === 'string' && item.url.startsWith('http')) {
        return true;
      }
      if (typeof item?.url === 'string' && item.url.startsWith('/uploads/')) {
        return true;
      }
      return false;
    })
    .map((item) => {
      if (!item?.url) return item;
      if (item.url.startsWith('http')) return item;
      if (item.url.startsWith('/uploads/')) {
        return {
          ...item,
          url: `${ASSISTANT_ASSET_BASE.replace(/\/+$/, '')}${item.url}`,
        };
      }
      return item;
    });
};

const buildContentParts = (question, stats, scope, images) => {
  const normalizedImages = normalizeImages(images);
  const parts = [
    {
      type: 'input_text',
      text: buildUserContent(question, stats, scope, normalizedImages),
    },
  ];
  normalizedImages.forEach((item) => {
    parts.push({
      type: 'input_image',
      image_url: item.dataUrl || item.url,
    });
  });
  return parts;
};

const getSessionKey = (sessionId, scope, thinkingType) => {
  const base =
    sessionId ||
    scope?.user?.userId ||
    scope?.user?.id ||
    scope?.user?.account ||
    'anonymous';
  return `${base}:${thinkingType ?? 'default'}`;
};

const getCachedPrefix = (sessionKey) => {
  const cached = prefixCache.get(sessionKey);
  if (!cached) return null;
  if (Date.now() - cached.updatedAt > cacheTtlMs) {
    prefixCache.delete(sessionKey);
    return null;
  }
  return cached;
};

const setCachedPrefix = (sessionKey, responseId) => {
  prefixCache.set(sessionKey, { responseId, updatedAt: Date.now() });
};

const normalizeThinking = (value) => {
  if (value === 'enabled' || value === 'disabled') {
    return value;
  }
  return undefined;
};

const ensurePrefixResponseId = async (sessionKey, thinkingType) => {
  const cached = getCachedPrefix(sessionKey);
  if (cached?.responseId) {
    cached.updatedAt = Date.now();
    return cached.responseId;
  }

  let useCaching = cacheAvailable;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ARK_API_KEY}`,
  };

  const buildPayload = () => {
    const payload = {
      model: ASSISTANT_MODEL,
      input: [{ role: 'system', content: systemPrompt }],
    };
    if (thinkingType) {
      payload.thinking = { type: thinkingType };
    }
    if (useCaching) {
      payload.caching = { type: 'enabled', prefix: true };
    }
    return payload;
  };

  let response = await fetchWithTimeout(responsesUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(buildPayload()),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const isCache403 =
      response.status === 403 &&
      text.includes('AccessDenied.CacheService');

    if (isCache403 && useCaching) {
      cacheAvailable = false;
      useCaching = false;
      console.warn('[assistant] cache service not enabled, fallback to no-cache');
      response = await fetchWithTimeout(responsesUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildPayload()),
      });
      if (!response.ok) {
        const retryText = await response.text().catch(() => '');
        throw new Error(
          `assistant cache warmup failed: ${response.status} ${retryText}`,
        );
      }
    } else {
      throw new Error(`assistant cache warmup failed: ${response.status} ${text}`);
    }
  }

  const data = await response.json();
  const responseId = extractResponseId(data);
  if (!responseId) {
    throw new Error('assistant cache warmup failed: missing response id');
  }

  setCachedPrefix(sessionKey, responseId);
  return responseId;
};

const extractResponseText = (payload) => {
  if (!payload) return '';
  const outputs = payload.output ?? [];
  for (const item of outputs) {
    const content = item?.content ?? [];
    for (const part of content) {
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.output_text === 'string') return part.output_text;
    }
  }
  return '';
};

const extractUsage = (payload) => {
  if (!payload) return null;
  if (payload.usage) return payload.usage;
  if (payload.response?.usage) return payload.response.usage;
  return null;
};

const extractResponseId = (payload) => {
  if (!payload) return null;
  if (typeof payload.id === 'string' && payload.id) return payload.id;
  if (typeof payload.response?.id === 'string' && payload.response.id) {
    return payload.response.id;
  }
  return null;
};

const parseSseChunk = (chunk) => {
  const lines = chunk.split('\n');
  let event = '';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  return { event, data: dataLines.join('\n') };
};

const streamResponses = async (response, res, stats, scope, sessionKey) => {
  const reader = response.body?.getReader();
  if (!reader) {
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'assistant stream failed' })}\n\n`);
    res.end();
    return;
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';
  let usage = null;
  let latestResponseId = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      const { event, data } = parseSseChunk(chunk);
      if (!data) continue;
      if (data === '[DONE]') {
        if (latestResponseId && sessionKey) {
          setCachedPrefix(sessionKey, latestResponseId);
        }
        res.write(
          `event: done\ndata: ${JSON.stringify({ answer: fullText, scope, stats })}\n\n`,
        );
        res.end();
        return;
      }

      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        fullText += data;
        res.write(`data: ${JSON.stringify({ delta: data })}\n\n`);
        continue;
      }

      const responseId = extractResponseId(payload);
      if (responseId) {
        latestResponseId = responseId;
      }

      const eventType = event || payload?.type || '';
      if (eventType.includes('output_text.delta')) {
        const delta = payload?.delta ?? payload?.text ?? '';
        if (delta) {
          fullText += delta;
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
      } else if (eventType === 'response.completed') {
        usage = extractUsage(payload) ?? usage;
        if (!fullText) {
          const text = extractResponseText(payload?.response);
          if (text) {
            fullText = text;
            res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
          }
        }
      }
    }
  }

  if (latestResponseId && sessionKey) {
    setCachedPrefix(sessionKey, latestResponseId);
  }

  res.write(
    `event: done\ndata: ${JSON.stringify({ answer: fullText, scope, stats, usage })}\n\n`,
  );
  res.end();
};

app.post('/assistant/answer', async (req, res) => {
  const { question, stats, scope, sessionId, thinking, images } = req.body || {};
  if (!question || !stats) {
    return res.status(400).json({ message: 'question/stats required' });
  }

  try {
    const thinkingType = normalizeThinking(thinking);
    const sessionKey = getSessionKey(sessionId, scope, thinkingType);
    const prefixResponseId = await ensurePrefixResponseId(sessionKey, thinkingType);
    const payload = {
      model: ASSISTANT_MODEL,
      input: [{ role: 'user', content: buildContentParts(question, stats, scope, images) }],
      caching: cacheAvailable ? { type: 'enabled' } : undefined,
      max_output_tokens: 1024,
    };
    if (thinkingType) {
      payload.thinking = { type: thinkingType };
    }
    if (prefixResponseId) {
      payload.previous_response_id = prefixResponseId;
    }

    const response = await fetchWithTimeout(responsesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return res.status(500).json({ message: `assistant failed: ${text}` });
    }

    const data = await response.json();
    const responseId = extractResponseId(data);
    if (responseId) {
      setCachedPrefix(sessionKey, responseId);
    }
    const answer = extractResponseText(data);
    const usage = extractUsage(data);
    return res.json({ answer, scope, stats, usage });
  } catch (err) {
    console.error('[assistant] failed', err);
    if (isTimeoutError(err)) {
      return res.json({ answer: fallbackAnswer, scope, stats, usage: null });
    }
    return res.status(500).json({ message: 'assistant failed' });
  }
});

app.post('/assistant/answer/stream', async (req, res) => {
  const { question, stats, scope, sessionId, thinking, images } = req.body || {};
  if (!question || !stats) {
    return res.status(400).json({ message: 'question/stats required' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write(`event: ready\ndata: {}\n\n`);

  try {
    const thinkingType = normalizeThinking(thinking);
    const sessionKey = getSessionKey(sessionId, scope, thinkingType);
    const prefixResponseId = await ensurePrefixResponseId(sessionKey, thinkingType);
    const payload = {
      model: ASSISTANT_MODEL,
      input: [{ role: 'user', content: buildContentParts(question, stats, scope, images) }],
      caching: cacheAvailable ? { type: 'enabled' } : undefined,
      max_output_tokens: 1024,
      stream: true,
    };
    if (thinkingType) {
      payload.thinking = { type: thinkingType };
    }
    if (prefixResponseId) {
      payload.previous_response_id = prefixResponseId;
    }

    const response = await fetchWithTimeout(responsesUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ message: text || 'assistant failed' })}\n\n`);
      res.end();
      return;
    }

    await streamResponses(response, res, stats, scope, sessionKey);
  } catch (err) {
    console.error('[assistant] stream failed', err);
    if (isTimeoutError(err)) {
      res.write(
        `event: done\ndata: ${JSON.stringify({ answer: fallbackAnswer, scope, stats })}\n\n`,
      );
      res.end();
      return;
    }
    res.write(`event: error\ndata: ${JSON.stringify({ message: 'assistant failed' })}\n\n`);
    res.end();
  }
});

app.listen(ASSISTANT_PORT, () => {
  console.log(`[assistant] listening on ${ASSISTANT_PORT}`);
});
