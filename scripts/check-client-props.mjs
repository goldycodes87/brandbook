// Checks that nothing handed to a client component carries a function.
//
//   npm run check:client-props
//
// This file exists because of a bug that cost a working admin section for
// days: the admin layout passed its room list — each room carrying an
// `allows` predicate — straight into AdminNav, a client component. React
// cannot serialize a function across that boundary, so every /admin page
// threw and returned a 500. TypeScript cannot see it, the build cannot see
// it, and it only fires once somebody is signed in far enough to render the
// layout, so it looked like a missing page rather than a crash.
//
// Transpiled in-process with the typescript devDependency, the same way
// check-expense-allocation.mjs does it.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT  = fs.mkdtempSync(path.join(os.tmpdir(), 'brandbook-props-'))

function load(rel, name) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
    // Strip the type-only import the module cannot resolve standalone.
    .replace(/^import type .*$/gm, '')
    .replace(/'@\/lib\/([\w-]+)'/g, "'./$1.js'")
  fs.writeFileSync(path.join(OUT, name + '.js'), js)
  return import(pathToFileURL(path.join(OUT, name + '.js')).href)
}

let failures = 0
const check = (name, cond, detail) => {
  if (cond) console.log('  ok   ' + name)
  else { failures++; console.log('  FAIL ' + name + (detail ? '  ->  ' + detail : '')) }
}

/** Every value React would have to serialize, flattened. */
function functionsIn(value, trail = '') {
  if (typeof value === 'function') return [trail || '(root)']
  if (Array.isArray(value)) return value.flatMap((v, i) => functionsIn(v, `${trail}[${i}]`))
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => functionsIn(v, trail ? `${trail}.${k}` : k))
  }
  return []
}

const { navRoomsFor, roomsFor, ADMIN_ROOMS } = await load('lib/admin-nav.ts', 'admin-nav')

// Every role, because the rooms differ by role and only one of them has to
// leak a function to take the whole section down.
const SESSIONS = {
  admin:   { canConfigure: true,  canManageData: true,  canSeeBilling: true  },
  manager: { canConfigure: true,  canManageData: false, canSeeBilling: true  },
  cpa:     { canConfigure: false, canManageData: false, canSeeBilling: true  },
}

console.log('admin nav props')
for (const [role, session] of Object.entries(SESSIONS)) {
  const rooms = navRoomsFor(session)
  const leaked = functionsIn(rooms)
  check(
    `navRoomsFor(${role}) is serializable`,
    leaked.length === 0,
    leaked.join(', '),
  )
  check(
    `navRoomsFor(${role}) survives JSON round-trip`,
    JSON.stringify(rooms) === JSON.stringify(JSON.parse(JSON.stringify(rooms))),
  )
  check(`navRoomsFor(${role}) returns rooms`, rooms.length > 0, String(rooms.length))
}

// The server-side list is SUPPOSED to carry predicates — that is what gates
// each room. If this ever comes back clean, the gate has been deleted.
const serverRooms = roomsFor(SESSIONS.admin)
check(
  'roomsFor still carries its allows predicates (the server-side gate)',
  functionsIn(serverRooms).length === serverRooms.length,
  `${functionsIn(serverRooms).length} of ${serverRooms.length}`,
)

check(
  'every room declares who may open it',
  ADMIN_ROOMS.every(r => typeof r.allows === 'function'),
)

console.log(failures === 0 ? '\nall good' : `\n${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
