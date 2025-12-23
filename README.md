# Firebase Data Provider

A small, focused Firestore data seeder used to feed demo data into Firebase for example UI applications in my GitHub portfolio. It exists purely for demonstrative purposes and is not intended for production use.

## Overview
- Seeds Firestore using JSON files stored under `scripts/seed-firestore/seeds`.
- Supports multiple apps by processing all seed JSON files in the seeds directory.
- Uses a Firebase Admin service account to authenticate.

## Project Structure
- `scripts/seed-firestore/index.js`: Seeder script.
- `scripts/seed-firestore/seeds/*.json`: Per-app seed data files.
- Optional fallback: `scripts/seed-firestore/firestore-seed.json` (single-file seed).

## Prerequisites
- Firebase project with Firestore enabled.
- Service Account JSON (Project Settings → Service accounts → Generate new private key).

## Configuration
Create `.env` in the project root with:
```
APP_ID_GUID=YOUR_APP_ID
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/serviceAccountKey.json
```
Notes:
- `APP_ID_GUID` is used if a seed file does not declare its own `appId`.
- If `FIREBASE_SERVICE_ACCOUNT_PATH` is omitted, the script looks for `scripts/seed-firestore/data-provider-firebase-adminsdk.json`.

## Usage
Install dependencies and run the seeder:
```bash
npm install
npm run seed:firestore
```
The script will:
- Load all JSON files under `scripts/seed-firestore/seeds/`.
- Resolve an `appId` per file (from the file or from `APP_ID_GUID`).
- Write collections/documents to Firestore. Primitive values are stored under a `value` field to avoid unintended string spreading.

## Multiple Apps
Add one JSON per app in `scripts/seed-firestore/seeds/`. Example files:
- `example-react-app.json`
- `example-vue-app.json`

Each file should include a `demoApps.collections` object with nested collections/documents. The script iterates all files and seeds Firestore per app.

## Disclaimer
This repository is for demos and learning. Review data models and security rules before adapting to real projects.
