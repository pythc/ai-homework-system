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
