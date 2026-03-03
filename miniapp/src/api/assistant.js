import { getApiBaseUrl, request, toAbsoluteUrl } from '../utils/http'
import { getAccessToken } from '../utils/storage'

function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalized}`
}

export async function sendAssistantMessage(question, options = {}) {
  const data = await request('/assistant/chat', {
    method: 'POST',
    data: {
      question,
      sessionId: options.sessionId || '',
      thinking: options.thinking || 'disabled',
      images: options.images || [],
    },
  })
  return data
}

function uploadSingleAssistantImage(filePath) {
  const token = getAccessToken()
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: buildUrl('/assistant/upload'),
      filePath,
      name: 'files',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const parsed = JSON.parse(res?.data || '{}')
          const first = parsed?.files?.[0]
          if (!first?.url) {
            reject(new Error('上传响应缺少图片地址'))
            return
          }
          resolve({
            name: first.name || filePath.split('/').pop() || 'image',
            url: toAbsoluteUrl(first.url),
          })
        } catch {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail: (err) => reject(err),
    })
  })
}

export async function uploadAssistantImages(filePaths = []) {
  const validPaths = filePaths.filter(Boolean)
  const uploaded = []
  for (const filePath of validPaths) {
    // Sequential upload keeps behavior stable across different MP base lib versions.
    // eslint-disable-next-line no-await-in-loop
    const item = await uploadSingleAssistantImage(filePath)
    uploaded.push(item)
  }
  return uploaded
}
