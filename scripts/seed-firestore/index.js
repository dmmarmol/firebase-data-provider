/*
 * Firestore seed script
 * Usage: npm run seed:firestore
 * Requires env: APP_ID_GUID (or NEXT_APP_ID_GUID)
 * Optional env: FIREBASE_SERVICE_ACCOUNT_PATH (defaults to local JSON file)
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../..', '.env') })
const { initializeApp, cert, getApps } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const APP_ID_PLACEHOLDER = 'APP_ID_GUID'
/**
 * Go to Project Settings → Service accounts → “Generate new private key”. 
 * Download the JSON. The private_key field inside that JSON is your NEXT_FIREBASE_PRIVATE_KEY
*/
const DEFAULT_SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  'data-provider-firebase-adminsdk.json'
)

function requireAppId() {
  const value = process.env.APP_ID_GUID || process.env.NEXT_APP_ID_GUID
  if (!value) throw new Error('Missing required env var: APP_ID_GUID')
  return value
}

function getAdminApp() {
  if (getApps().length) return getApps()[0]

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_SERVICE_ACCOUNT_PATH

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(
      `Service account JSON not found at ${serviceAccountPath}. ` +
        'Set FIREBASE_SERVICE_ACCOUNT_PATH to your serviceAccountKey.json.'
    )
  }

  const serviceAccount = require(serviceAccountPath)

  return initializeApp({
    credential: cert(serviceAccount),
  })
}

function loadSeed() {
  const seedPath = path.join(process.cwd(), 'scripts', 'seed-firestore', 'firestore-seed.json')
  const raw = fs.readFileSync(seedPath, 'utf8')
  return JSON.parse(raw)
}

function replaceAppId(value, appId) {
  if (typeof value === 'string' && value === APP_ID_PLACEHOLDER) return appId;
  if (typeof value === 'string') return value; // Ensure plain strings are returned
  if (Array.isArray(value)) return value.map((v) => replaceAppId(v, appId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, replaceAppId(v, appId)])
    );
  }
  return value;
}

async function importCollections(collections, parentRef, appId) {
  for (const [collectionName, docs] of Object.entries(collections)) {
    for (const [docIdRaw, docData] of Object.entries(docs)) {
      const docId = docIdRaw === APP_ID_PLACEHOLDER ? appId : docIdRaw
      const { collections, ...fields } = docData
      const payload = replaceAppId(fields, appId)
      const docRef = parentRef.collection(collectionName).doc(docId)
      await docRef.set(payload)
      if (collections) {
        await importCollections(collections, docRef, appId)
      }
    }
  }
}

async function main() {
  const appId = requireAppId()
  const seed = loadSeed()

  if (!seed.demoApps || !seed.demoApps.collections) {
    throw new Error('Seed file missing root demoApps.collections')
  }

  const db = getFirestore(getAdminApp())
  await importCollections(seed.demoApps.collections, db, appId)

  console.log('Firestore seed completed for appId:', appId)
}

main().catch((err) => {
  console.error('Firestore seed failed:', err)
  process.exit(1)
})
