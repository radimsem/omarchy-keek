// Run: node tests/model.test.js
const fs = require("fs")
const path = require("path")
const assert = require("assert")

const src = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8").replace(/^\.pragma library\s*/, "")
const mod = { exports: {} }
new Function("module", src)(mod)
const M = mod.exports

let failed = 0
function test(name, fn) {
  try { fn(); console.log("ok   " + name) } catch (e) { failed++; console.log("FAIL " + name + "\n     " + e.message) }
}

function session(fields) {
  return Object.assign({
    n: 1, project: "myapp", branch: "fix/17-login", color: "#4ccce0",
    opened_at: "2026-11-26T09:14:03Z", state: "working", verdict: null,
    detail: "click \"Sign in\" · now", checks: "pp-", in_focus: true
  }, fields)
}

function barJson(sessions, version) {
  return JSON.stringify({ version: version === undefined ? 1 : version, sessions: sessions })
}

// Bar State

test("a bar state with sessions yields one entry per session", () => {
  const sessions = M.parseBarState(barJson([session({ n: 1 }), session({ n: 2, project: "billing", branch: null })]))
  assert.strictEqual(sessions.length, 2)
  assert.strictEqual(sessions[1].project, "billing")
  assert.strictEqual(sessions[1].branch, "")
  assert.strictEqual(sessions[0].inFocus, true)
  assert.strictEqual(sessions[0].openedAt, Date.parse("2026-11-26T09:14:03Z"))
})

test("an empty, unreadable or unknown-version bar state hides the widget", () => {
  assert.deepStrictEqual(M.parseBarState(""), [])
  assert.deepStrictEqual(M.parseBarState("{\"version\": 1, \"sess"), [])
  assert.deepStrictEqual(M.parseBarState(barJson([])), [])
  assert.deepStrictEqual(M.parseBarState(barJson([session({})], 2)), [])
  assert.deepStrictEqual(M.parseBarState(barJson([session({})], "1")), [])
  assert.deepStrictEqual(M.parseBarState("{\"version\": 1}"), [])
})

test("a session without a usable number is dropped", () => {
  const sessions = M.parseBarState(barJson([session({ n: 0 }), session({ n: "2" }), session({ n: 3 })]))
  assert.deepStrictEqual(sessions.map((s) => s.n), [3])
})

test("checks keep only the letters the schema defines", () => {
  assert.strictEqual(M.parseBarState(barJson([session({ checks: "pfs-x" })]))[0].checks, "pfs-")
})

// Button state

test("off keek the button is idle, on keek it is here", () => {
  const sessions = [session({})]
  assert.strictEqual(M.buttonState(sessions, false), "idle")
  assert.strictEqual(M.buttonState(sessions, true), "here")
})

test("a Help Request turns the button to needs you on any workspace", () => {
  const sessions = [session({ n: 1 }), session({ n: 2, state: "needs_you" })]
  assert.strictEqual(M.buttonState(sessions, false), "needs")
  assert.strictEqual(M.buttonState(sessions, true), "needs")
})

test("a running or paused Takeover makes the button inert, over a Help Request", () => {
  assert.strictEqual(M.buttonState([session({ state: "takeover" }), session({ n: 2, state: "needs_you" })], false), "takeover")
  assert.strictEqual(M.buttonState([session({ state: "takeover_paused" })], true), "takeover")
})

test("the needs-you session is the lowest-numbered one waiting", () => {
  const sessions = [session({ n: 1 }), session({ n: 3, state: "needs_you" }), session({ n: 4, state: "needs_you" })]
  assert.strictEqual(M.needsYouSession(sessions).n, 3)
  assert.strictEqual(M.needsYouSession([session({})]), null)
})

// Clicks

test("a click off keek focuses keek", () => {
  assert.deepStrictEqual(M.buttonDispatches([session({})], false, null), ["hl.dsp.focus({ workspace = \"name:keek\" })"])
})

test("a click while a session needs you also shows that session", () => {
  const sessions = [session({ n: 1 }), session({ n: 2, state: "needs_you" })]
  const expected = ["hl.dsp.focus({ workspace = \"name:keek\" })", "hl.dsp.event(\"keek-show 2\")"]
  assert.deepStrictEqual(M.buttonDispatches(sessions, false, null), expected)
  assert.deepStrictEqual(M.buttonDispatches(sessions, true, M.recordWorkspace(null, 3, "3")), expected)
})

test("a click on keek goes back to the recorded workspace", () => {
  assert.deepStrictEqual(M.buttonDispatches([session({})], true, M.recordWorkspace(null, 3, "3")), ["hl.dsp.focus({ workspace = \"3\" })"])
  assert.deepStrictEqual(M.buttonDispatches([session({})], true, M.recordWorkspace(null, -98, "B")), ["hl.dsp.focus({ workspace = \"name:B\" })"])
})

test("a click on keek with no recorded workspace goes to workspace 1", () => {
  assert.deepStrictEqual(M.buttonDispatches([session({})], true, null), ["hl.dsp.focus({ workspace = \"1\" })"])
})

test("a click during a Takeover does nothing", () => {
  assert.deepStrictEqual(M.buttonDispatches([session({ state: "takeover" })], false, null), [])
  assert.deepStrictEqual(M.buttonDispatches([session({ state: "takeover_paused" })], true, null), [])
})

test("a row click focuses keek and shows that session, except during a Takeover", () => {
  assert.deepStrictEqual(M.rowDispatches([session({ n: 1 }), session({ n: 4 })], 4),
    ["hl.dsp.focus({ workspace = \"name:keek\" })", "hl.dsp.event(\"keek-show 4\")"])
  assert.deepStrictEqual(M.rowDispatches([session({ n: 1, state: "takeover" }), session({ n: 4 })], 4), [])
})

test("a workspace name is escaped inside the Lua string", () => {
  const previous = M.recordWorkspace(null, -97, "a\"b\\c")
  assert.deepStrictEqual(M.buttonDispatches([session({})], true, previous), ["hl.dsp.focus({ workspace = \"name:a\\\"b\\\\c\" })"])
})

// Previous workspace

test("the previous workspace skips keek, keek-rail and special workspaces", () => {
  let previous = M.recordWorkspace(null, 2, "2")
  previous = M.recordWorkspace(previous, -99, "keek")
  previous = M.recordWorkspace(previous, -98, "keek-rail")
  previous = M.recordWorkspace(previous, -97, "special:scratch")
  previous = M.recordWorkspace(previous, -99, "keek")
  assert.strictEqual(previous.target, "2")
  assert.strictEqual(previous.label, "workspace 2")
})

test("no focused workspace, or one without a name yet, keeps the record", () => {
  const previous = M.recordWorkspace(null, 2, "2")
  assert.strictEqual(M.recordWorkspace(previous, 3, ""), previous)
  assert.strictEqual(M.recordWorkspace(previous, undefined, undefined), previous)
  assert.strictEqual(M.recordWorkspace(null, 0, ""), null)
})

// Binds

function bind(fields) {
  return Object.assign({ modmask: 64, submap: "", key: "F1", dispatcher: "__lua", arg: "304" }, fields)
}

test("Super+Shift+K shows only when it is bound outside any submap", () => {
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 65 })]).launch, true)
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 64 })]).launch, false)
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 73 })]).launch, false)
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 65, submap: "keek" })]).launch, false)
})

test("a plain Super+Shift+K bind must dispatch to the keek workspace", () => {
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 65, dispatcher: "workspace", arg: "name:keek" })]).launch, true)
  assert.strictEqual(M.bindsShown([bind({ key: "K", modmask: 65, dispatcher: "workspace", arg: "3" })]).launch, false)
})

test("a Super F key shows only for the keys that are bound", () => {
  const shown = M.bindsShown([bind({ key: "F1" }), bind({ key: "F3" }), bind({ key: "F2", submap: "keek" }), bind({ key: "F4", modmask: 0 })])
  assert.deepStrictEqual([1, 2, 3, 4].map((n) => M.showsKey(shown, n)), [true, false, true, false])
})

test("a plain Super F bind must emit keek-show with its own number", () => {
  const shown = M.bindsShown([bind({ key: "F1", dispatcher: "event", arg: "keek-show 1" }), bind({ key: "F2", dispatcher: "event", arg: "keek-show 1" })])
  assert.deepStrictEqual([M.showsKey(shown, 1), M.showsKey(shown, 2)], [true, false])
})

test("a row shows its Super F key only on keek, where keek's binds act", () => {
  const shown = M.bindsShown([bind({ key: "F2" })])
  assert.strictEqual(M.rowShowsKey(shown, 2, true), true)
  assert.strictEqual(M.rowShowsKey(shown, 2, false), false)
  assert.strictEqual(M.rowShowsKey(shown, 1, true), false)
})

test("unreadable binds show no shortcut", () => {
  const shown = M.bindsShown(M.parseJson("not json"))
  assert.strictEqual(shown.launch, false)
  assert.strictEqual(M.showsKey(shown, 1), false)
})

// Copy and marks

test("the button label names the count and the needs-you state", () => {
  assert.strictEqual(M.ariaLabel("idle", 1), "keek, 1 session. Show the keek workspace.")
  assert.strictEqual(M.ariaLabel("here", 3), "keek, 3 sessions. Go back to the previous workspace.")
  assert.strictEqual(M.ariaLabel("needs", 2), "keek, 2 sessions, one needs you. Show it.")
  assert.strictEqual(M.ariaLabel("takeover", 2), "keek, 2 sessions. You are in control until you press Done.")
})

test("dots ring every waiting session in white and mark ended ones", () => {
  const dots = M.dots([session({ n: 1 }), session({ n: 2, state: "needs_you", color: "#a77bf3" }), session({ n: 3, state: "ended" })])
  assert.deepStrictEqual(dots.map((d) => [d.waiting, d.ended]), [[false, false], [true, false], [false, true]])
  assert.strictEqual(dots[1].color, "#a77bf3")
})

test("elapsed time reads in minutes, then hours", () => {
  assert.strictEqual(M.elapsed(0, 65000), "1:05")
  assert.strictEqual(M.elapsed(0, 3661000), "1:01:01")
  assert.strictEqual(M.elapsed(5000, 0), "0:00")
  assert.strictEqual(M.elapsed(NaN, 1000), "")
})

test("ticks mark the first unmarked Check only while the Verifier works", () => {
  assert.deepStrictEqual(M.ticks("pf-s-", "working").map((t) => [t.mark, t.current]),
    [["p", false], ["f", false], ["-", true], ["s", false], ["-", false]])
  assert.strictEqual(M.ticks("p-", "needs_you").some((t) => t.current), false)
  assert.strictEqual(M.ticks("p-", "ended").some((t) => t.current), false)
  assert.strictEqual(M.checksMarked("pf-s-"), 3)
})

test("the list footer says where the button goes", () => {
  assert.strictEqual(M.footerText("idle", M.recordWorkspace(null, 1, "1")),
    "Click a session to show it on keek. On keek, click the button again to go back to workspace 1.")
  assert.strictEqual(M.footerText("here", null),
    "Click a session to show it on keek. On keek, click the button again to go back to workspace 1.")
  assert.strictEqual(M.footerText("needs", null),
    "Click a session to show it on keek. Click the button to show the session that needs you.")
  assert.strictEqual(M.footerText("takeover", null), "Sessions unlock when you press Done.")
})

if (failed) { console.log(failed + " failed"); process.exit(1) }
