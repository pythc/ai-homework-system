const normalizeBaseUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const isObject = (value) => value !== null && typeof value === 'object';

const unwrapPayload = (payload) => {
  if (!isObject(payload)) return payload;
  if ('code' in payload && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

const buildUrlWithQuery = (baseUrl, path, query) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  const entries = Object.entries(query || {});
  for (const [key, rawValue] of entries) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    url.searchParams.set(key, String(rawValue));
  }
  return url.toString();
};

const asArray = (value) => (Array.isArray(value) ? value : []);

export const createMcpApiClient = ({
  apiBaseUrl,
  authHeader,
  requestWithTimeout,
  timeoutMs,
}) => {
  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  const token = String(authHeader || '').trim();

  if (!baseUrl) {
    throw new Error('MCP API base URL is empty');
  }

  if (!token) {
    throw new Error('Missing authorization header for MCP API client');
  }

  let profilePromise = null;

  const request = async (path, options = {}) => {
    const {
      method = 'GET',
      query,
      body,
    } = options;

    const response = await requestWithTimeout(
      buildUrlWithQuery(baseUrl, path, query),
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      timeoutMs,
    );

    const text = await response.text().catch(() => '');
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const detail = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
      throw new Error(`MCP API ${method} ${path} failed: ${response.status} ${detail}`);
    }

    return unwrapPayload(payload);
  };

  const getCurrentUser = async () => {
    if (!profilePromise) {
      profilePromise = request('/auth/me');
    }
    return profilePromise;
  };

  const getCurrentRole = async () => {
    const profile = await getCurrentUser();
    return String(profile?.role || '').toUpperCase();
  };

  const listCourses = async ({ status, semester } = {}) => {
    const result = await request('/courses', {
      query: { status, semester },
    });
    return asArray(result);
  };

  const listAssignments = async ({ courseId } = {}) => {
    const role = await getCurrentRole();
    if (role === 'STUDENT') {
      const openAssignments = asArray(await request('/assignments/open'));
      return courseId
        ? openAssignments.filter((item) => String(item?.courseId || '') === String(courseId))
        : openAssignments;
    }

    const teacherAssignments = asArray(await request('/assignments/teacher-list'));
    return courseId
      ? teacherAssignments.filter((item) => String(item?.courseId || '') === String(courseId))
      : teacherAssignments;
  };

  const listCourseStudents = async (courseId) => {
    if (!courseId) {
      throw new Error('courseId is required to list course students');
    }
    const result = await request(`/courses/${courseId}/students`);
    return asArray(result);
  };

  const getCourseSummary = async (courseId) => {
    if (!courseId) {
      throw new Error('courseId is required to get course summary');
    }
    return request(`/courses/${courseId}/summary`);
  };

  const listMyScores = async () => {
    const result = await request('/scores/me');
    return asArray(result);
  };

  const getMyAssignmentScore = async (assignmentId) => {
    if (!assignmentId) {
      throw new Error('assignmentId is required to get assignment score');
    }
    return request(`/scores/me/${assignmentId}`);
  };

  const getAssistantUsage = async () => request('/assistant/usage');

  return {
    getCurrentUser,
    getCurrentRole,
    listCourses,
    listAssignments,
    listCourseStudents,
    getCourseSummary,
    listMyScores,
    getMyAssignmentScore,
    getAssistantUsage,
  };
};
