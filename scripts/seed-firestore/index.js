/*
 * Firestore seed script
 * Usage: npm run seed:firestore
 * Seed data now lives in scripts/seed-firestore/seeds/*.json (one file per app)
 * Requires env: APP_ID_GUID (or NEXT_APP_ID_GUID) only when a seed file omits appId
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

function getEnvAppId() {
  return process.env.APP_ID_GUID || process.env.NEXT_APP_ID_GUID
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

function loadSeedFiles() {
  const seedsDir = path.join(__dirname, 'seeds')
  const seedFiles = fs.existsSync(seedsDir)
    ? fs.readdirSync(seedsDir).filter((file) => file.endsWith('.json'))
    : []

  const seeds = seedFiles.map((file) => {
    const raw = fs.readFileSync(path.join(seedsDir, file), 'utf8')
    return { file, data: JSON.parse(raw) }
  })

  if (!seeds.length) {
    const fallbackPath = path.join(__dirname, 'firestore-seed.json')
    if (fs.existsSync(fallbackPath)) {
      const raw = fs.readFileSync(fallbackPath, 'utf8')
      seeds.push({ file: 'firestore-seed.json', data: JSON.parse(raw) })
    }
  }

  if (!seeds.length) {
    throw new Error(
      'No seed JSON files found. Add files to scripts/seed-firestore/seeds or keep firestore-seed.json.'
    )
  }

  return seeds
}

function resolveAppId(seed, fileName) {
  if (seed.appId) return seed.appId
  const envValue = getEnvAppId()
  if (!envValue) {
    throw new Error(
      `Seed file ${fileName} missing appId and APP_ID_GUID/NEXT_APP_ID_GUID is not set.`
    )
  }
  return envValue
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
      if (docData == null) {
        throw new Error(
          `Seed data for ${collectionName}/${docId} is null or undefined`
        )
      }

      let payload
      let nestedCollections

      if (typeof docData === 'object' && !Array.isArray(docData)) {
        const { collections, ...fields } = docData
        payload = replaceAppId(fields, appId)
        nestedCollections = collections
      } else {
        // If the seed value is a primitive (string/number/boolean/array),
        // persist it under a generic `value` field to avoid spreading strings
        // into character maps.
        payload = { value: replaceAppId(docData, appId) }
        nestedCollections = undefined
      }
      const docRef = parentRef.collection(collectionName).doc(docId)
      await docRef.set(payload)
      if (nestedCollections) {
        await importCollections(nestedCollections, docRef, appId)
      }
    }
  }
}

async function main() {
  const seeds = loadSeedFiles()
  const db = getFirestore(getAdminApp())

  for (const seed of seeds) {
    if (!seed.data.demoApps || !seed.data.demoApps.collections) {
      throw new Error(`Seed file ${seed.file} missing root demoApps.collections`)
    }

    const appId = resolveAppId(seed.data, seed.file)
    await importCollections(seed.data.demoApps.collections, db, appId)

    console.log(`Firestore seed completed for file ${seed.file} (appId: ${appId})`)
  }
}

main().catch((err) => {
  console.error('Firestore seed failed:', err)
  process.exit(1)
})
