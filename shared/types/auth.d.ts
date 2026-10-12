declare module '#auth-utils' {
  interface User {
    id: 'owner'
    email: string
  }

  interface SecureSessionData {
    passwordVersion: string
  }
}

export {}
