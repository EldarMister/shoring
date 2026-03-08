import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function normalizePrivateKey(value) {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')
}

function readServiceAccountFromEnv() {
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim()
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim()
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

function createFirebaseAdminApp() {
  const existingApp = getApps()[0]
  if (existingApp) {
    return existingApp
  }

  const serviceAccount = readServiceAccountFromEnv()
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    })
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    })
  }

  throw new Error(
    'Firebase Admin SDK is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
  )
}

export function getFirebaseAdminAuth() {
  return getAuth(createFirebaseAdminApp())
}
