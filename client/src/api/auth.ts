import { httpRequest } from './http'

export const AccountType = {
  STUDENT_ID: 'STUDENT_ID',
  EMAIL: 'EMAIL',
  USERNAME: 'USERNAME',
} as const

export type AccountTypeValue = (typeof AccountType)[keyof typeof AccountType]

export type LoginRequest = {
  schoolId: string
  accountType: AccountTypeValue
  account: string
  password: string
  deviceId?: string
}

type LoginResponse = {
  code: number
  message: string
  data: {
    token: {
      accessToken: string
      refreshToken: string
      tokenType: 'Bearer'
      expiresIn: number
    }
    user: {
      userId: string
      role: string
      schoolId: string
      accountType: string
      account: string
      name?: string | null
      createdAt?: string
      updatedAt?: string
    }
  }
}

export async function login(request: LoginRequest) {
  return httpRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: request,
  })
}

export type ChangePasswordRequest = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

type ChangePasswordResponse = {
  code: number
  message: string
}

export async function changePassword(
  request: ChangePasswordRequest,
  token?: string | null,
) {
  return httpRequest<ChangePasswordResponse>('/auth/password', {
    method: 'PATCH',
    body: request,
    token,
  })
}

type MeResponse = {
  code: number
  message: string
  data: {
    userId: string
    role: string
    schoolId: string
    accountType: string
    account: string
    name?: string | null
    createdAt?: string
    updatedAt?: string
  } | null
}

export async function getMe(token?: string | null) {
  return httpRequest<MeResponse>('/auth/me', {
    method: 'GET',
    token,
  })
}


type BulkRegisterResult = {
  total: number
  created: number
  skipped: number
  errors: Array<{ row: number; reason: string; account?: string }>
  course?: {
    id: string
    name: string
    semester: string
    status: 'ACTIVE' | 'ARCHIVED'
    teacherId: string
  } | null
  enrolled?: number
}

type BulkRegisterResponse = {
  code: number
  message: string
  data: BulkRegisterResult
}

export async function registerBulkUsers(
  file: File,
  payload: {
    schoolId: string
    courseName: string
    className?: string
    semester: string
    status?: 'ACTIVE' | 'ARCHIVED'
  },
) {
  const form = new FormData()
  form.append('file', file)
  form.append('schoolId', payload.schoolId)
  form.append('courseName', payload.courseName)
  if (payload.className) {
    form.append('className', payload.className)
  }
  form.append('semester', payload.semester)
  if (payload.status) {
    form.append('status', payload.status)
  }
  return httpRequest<BulkRegisterResponse>('/auth/register/bulk', {
    method: 'POST',
    body: form,
  })
}
