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
    }
  }
}

export async function login(request: LoginRequest) {
  return httpRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: request,
  })
}
