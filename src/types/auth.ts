export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  isInstanceAdmin: boolean
  createdAt: Date
}

export interface Session {
  id: string
  userId: string
  token: string
  expiresAt: Date
  createdAt: Date
}

export interface AuthState {
  user: User | null
  isLoading: boolean
}
