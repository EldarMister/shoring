import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

function readRuntimeValue(key) {
  if (typeof window === 'undefined') return ''
  return String(window.__APP_CONFIG__?.[key] || '')
}

function readFirebaseConfigValue(key) {
  return readRuntimeValue(key) || String(import.meta.env[key] || '')
}

const firebaseConfig = {
  apiKey: readFirebaseConfigValue('VITE_FIREBASE_API_KEY'),
  authDomain: readFirebaseConfigValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readFirebaseConfigValue('VITE_FIREBASE_PROJECT_ID'),
  appId: readFirebaseConfigValue('VITE_FIREBASE_APP_ID'),
  messagingSenderId: readFirebaseConfigValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  storageBucket: readFirebaseConfigValue('VITE_FIREBASE_STORAGE_BUCKET'),
}

const requiredEnvKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
]

const missingEnvKeys = requiredEnvKeys.filter((key) => !readFirebaseConfigValue(key))

export const isFirebaseConfigured = missingEnvKeys.length === 0
export const firebaseConfigError = isFirebaseConfigured
  ? ''
  : `Заполните ${missingEnvKeys.join(', ')}`

export const firebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null

if (firebaseAuth) {
  firebaseAuth.languageCode = 'ru'
}
