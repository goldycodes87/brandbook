// Checks the shape of every RancherAI write action.
//
//   npm run check:write-actions
//
// The registry generates tool schemas that go straight to the model, and none
// of what can go wrong there is visible to TypeScript: a `required` field that
// is not in `input` makes the model send something the action never reads, two
// actions sharing a name means one silently shadows the other, and a tool name
// outside the API's character set is rejected for the whole request — every
// tool, not just the bad one.
//
// Transpiled in-process with the typescript devDependency, the same way
// check-expense-allocation.mjs does it. Nothing here touches the database:
// importing the module does not open a connection, and no action is run.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT  = fs.mkdtempSync(path.join(os.tmpdir(), 'brandbook-actions-'))

// Stubbed rather than transpiled: the registry imports it for its return type
// and to build clients, and a client is only ever constructed inside an action
// we do not call.
fs.writeFileSync(path.join(OUT, 'admin.js'),
  'export function createAdminClient() { throw new Error("no database in this check") }\n')

// preg-check-followup reaches for the browser fetch helpers at module scope.
// Nothing here calls them; only its CALVING_LEAD_DAYS is wanted.
fs.writeFileSync(path.join(OUT, 'fetch.js'),
  'export const apiPost = () => { throw new Error("no network in this check") }\n' +
  'export const apiPatch = () => { throw new Error("no network in this check") }\n')

for (const [rel, name] of [
  ['lib/database.types.ts', 'database.types'],
  ['lib/db-enums.ts', 'db-enums'],
  ['lib/preg-check-followup.ts', 'preg-check-followup'],
  ['lib/rancher-ai/write-actions.ts', 'write-actions'],
]) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText
    .replace(/'@\/lib\/supabase\/admin'/g, "'./admin.js'")
    // The dot in database.types matters — a [\w-] class silently leaves that
    // import alone, and node then goes looking for a package called "@/lib".
    .replace(/'@\/lib\/([\w.-]+)'/g, "'./$1.js'")
  fs.writeFileSync(path.join(OUT, name + '.js'), js)
}

const { WRITE_ACTIONS, toolSpecFor, proposeToolName } =
  await import(pathToFileURL(path.join(OUT, 'write-actions.js')).href)

let failures = 0
const fail = (msg) => { failures++; console.log('  FAIL ' + msg) }
const ok   = (msg) => console.log('  ok   ' + msg)

// Anthropic's tool-name rule. One bad name fails the entire request.
const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/

const seen = new Set()

for (const action of WRITE_ACTIONS) {
  const spec = toolSpecFor(action)
  const where = action.name

  if (seen.has(action.name)) fail(`${where}: duplicate action name`)
  seen.add(action.name)

  if (!NAME_RE.test(spec.name)) fail(`${where}: tool name "${spec.name}" is not a legal tool name`)

  if (!action.description || action.description.length < 20) {
    fail(`${where}: description is too thin for the model to choose on`)
  }

  const inputKeys = Object.keys(action.input ?? {})
  if (inputKeys.length === 0) fail(`${where}: no input fields`)

  for (const req of action.required ?? []) {
    if (!inputKeys.includes(req)) {
      fail(`${where}: "${req}" is required but is not one of its input fields`)
    }
  }

  for (const [field, schema] of Object.entries(action.input ?? {})) {
    if (!schema || typeof schema !== 'object') { fail(`${where}.${field}: not a schema object`); continue }
    if (!schema.type) fail(`${where}.${field}: no type`)
    if (!schema.description) fail(`${where}.${field}: no description — the model is guessing`)
    if (schema.enum && !Array.isArray(schema.enum)) fail(`${where}.${field}: enum is not a list`)
  }

  if (typeof action.prepare !== 'function') fail(`${where}: no prepare`)
  if (typeof action.execute !== 'function') fail(`${where}: no execute`)
  if (!['operations', 'billing_draft'].includes(action.tier)) fail(`${where}: unknown tier "${action.tier}"`)

  if (failures === 0 || !spec) continue
}

if (failures === 0) ok(`${WRITE_ACTIONS.length} write actions, all well formed`)

// The proposal prefix is what keeps read tools and write tools apart; losing it
// would let a read-shaped name reach the executor.
for (const action of WRITE_ACTIONS) {
  if (!proposeToolName(action).startsWith('propose_')) {
    fail(`${action.name}: generated tool name has lost its propose_ prefix`)
  }
}

const billing = WRITE_ACTIONS.filter(a => a.tier === 'billing_draft').map(a => a.name)
console.log(`\n  ${WRITE_ACTIONS.length} actions · ${billing.length} billing draft (${billing.join(', ') || 'none'})`)

fs.rmSync(OUT, { recursive: true, force: true })
process.exit(failures > 0 ? 1 : 0)
