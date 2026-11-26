.pragma library

// Pure helpers for the keek widget. Nothing here touches QML objects, so the
// logic runs under node too (see tests/model.test.js).

// The Bar State schema version this widget reads. keek and the widget release
// separately, so a version it doesn't know hides the widget rather than guess.
var VERSION = 1

var KEEK = "keek"
var RAIL = "keek-rail"
var FALLBACK_WORKSPACE = { target: "1", label: "workspace 1" }

// Hyprland reports modifiers as a bitmask: Shift is bit 0, Super is bit 6.
var SHIFT = 1
var SUPER = 64

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch (e) {
    return null
  }
}

function parseBarState(text) {
  var state = parseJson(text)
  if (!state || state.version !== VERSION || !Array.isArray(state.sessions)) return []
  var sessions = []
  for (var i = 0; i < state.sessions.length; i++) {
    var raw = state.sessions[i]
    if (!raw || typeof raw.n !== "number" || raw.n < 1 || Math.floor(raw.n) !== raw.n) continue
    sessions.push({
      n: raw.n,
      project: String(raw.project || ""),
      branch: typeof raw.branch === "string" ? raw.branch : "",
      color: typeof raw.color === "string" ? raw.color : "#ffffff",
      openedAt: Date.parse(raw.opened_at),
      state: String(raw.state || ""),
      verdict: raw.verdict || null,
      detail: String(raw.detail || ""),
      checks: String(raw.checks || "").replace(/[^pfs-]/g, ""),
      inFocus: raw.in_focus === true
    })
  }
  return sessions
}

function isTakeover(sessions) {
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].state === "takeover" || sessions[i].state === "takeover_paused") return true
  }
  return false
}

// Sessions arrive ordered by n, so the first waiting one has the lowest number.
function needsYouSession(sessions) {
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].state === "needs_you") return sessions[i]
  }
  return null
}

// One of "takeover", "needs", "here" or "idle".
function buttonState(sessions, onKeek) {
  if (isTakeover(sessions)) return "takeover"
  if (needsYouSession(sessions)) return "needs"
  return onKeek ? "here" : "idle"
}

function luaString(value) {
  return "\"" + String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\""
}

function focusDispatch(target) {
  return "hl.dsp.focus({ workspace = " + luaString(target) + " })"
}

function showDispatches(n) {
  return [focusDispatch("name:" + KEEK), "hl.dsp.event(" + luaString("keek-show " + n) + ")"]
}

// The Lua dispatchers a button click runs, in order. Empty means the click does nothing.
function buttonDispatches(sessions, onKeek, previous) {
  var state = buttonState(sessions, onKeek)
  if (state === "takeover") return []
  if (state === "needs") return showDispatches(needsYouSession(sessions).n)
  if (state === "here") return [focusDispatch((previous || FALLBACK_WORKSPACE).target)]
  return [focusDispatch("name:" + KEEK)]
}

function rowDispatches(sessions, n) {
  return isTakeover(sessions) ? [] : showDispatches(n)
}

// Folds the newly focused workspace into the last one worth going back to.
// Hyprland's own "previous" can name keek-rail after a rail swap, so the
// widget keeps its own record.
function recordWorkspace(previous, id, name) {
  name = typeof name === "string" ? name : ""
  if (!name || name === KEEK || name === RAIL || name.indexOf("special:") === 0) return previous
  if (id > 0) return { target: String(id), label: "workspace " + name }
  return { target: "name:" + name, label: "workspace " + name }
}

function bindsDispatchToKeek(bind) {
  // A Lua bind shows only as "__lua" and a reference number, so its target can't be read.
  return bind.dispatcher === "__lua" || (bind.dispatcher === "workspace" && bind.arg === "name:" + KEEK)
}

function bindEmitsShow(bind, n) {
  return bind.dispatcher === "__lua" || (bind.dispatcher === "event" && bind.arg === "keek-show " + n)
}

// Which keek shortcuts `hyprctl binds -j` lists outside any submap.
function bindsShown(binds) {
  var shown = { launch: false, keys: {} }
  if (!Array.isArray(binds)) return shown
  for (var i = 0; i < binds.length; i++) {
    var bind = binds[i]
    if (!bind || bind.submap !== "") continue
    var key = String(bind.key || "").toUpperCase()
    var mask = Number(bind.modmask) || 0
    if (key === "K" && mask === (SUPER | SHIFT) && bindsDispatchToKeek(bind)) shown.launch = true
    var fkey = /^F([1-4])$/.exec(key)
    if (fkey && (mask & SUPER) !== 0 && bindEmitsShow(bind, fkey[1])) shown.keys[fkey[1]] = true
  }
  return shown
}

function showsKey(shown, n) {
  return !!(shown && shown.keys && shown.keys[String(n)])
}

// keek's Super F binds act only while keek is the active workspace.
function rowShowsKey(shown, n, onKeek) {
  return onKeek === true && showsKey(shown, n)
}

function sessionCount(count) {
  return count === 1 ? "1 session" : count + " sessions"
}

function ariaLabel(state, count) {
  var label = "keek, " + sessionCount(count)
  if (state === "needs") return label + ", one needs you. Show it."
  if (state === "here") return label + ". Go back to the previous workspace."
  if (state === "takeover") return label + ". You are in control until you press Done."
  return label + ". Show the keek workspace."
}

function dots(sessions) {
  var out = []
  for (var i = 0; i < sessions.length; i++) {
    out.push({
      n: sessions[i].n,
      color: sessions[i].color,
      waiting: sessions[i].state === "needs_you",
      ended: sessions[i].state === "ended"
    })
  }
  return out
}

function pad(value) {
  return value < 10 ? "0" + value : String(value)
}

// "1:05", or "1:01:01" past an hour, as the Session Footer counts.
function elapsed(fromMs, nowMs) {
  if (!isFinite(fromMs) || !isFinite(nowMs)) return ""
  var seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000))
  var hours = Math.floor(seconds / 3600)
  var minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return hours + ":" + pad(minutes) + ":" + pad(seconds % 60)
  return minutes + ":" + pad(seconds % 60)
}

// One tick per Check. While the Verifier works, the first unmarked Check is
// the one being checked; the mark is absent in every other state.
function ticks(checks, state) {
  var current = state === "working" ? checks.indexOf("-") : -1
  var out = []
  for (var i = 0; i < checks.length; i++) out.push({ mark: checks[i], current: i === current })
  return out
}

function checksMarked(checks) {
  return checks.replace(/-/g, "").length
}

function footerText(state, previous) {
  if (state === "takeover") return "Sessions unlock when you press Done."
  var first = "Click a session to show it on keek. "
  if (state === "needs") return first + "Click the button to show the session that needs you."
  return first + "On keek, click the button again to go back to " + (previous || FALLBACK_WORKSPACE).label + "."
}

// node / CommonJS export for tests; ignored by QML.
if (typeof module !== "undefined") {
  module.exports = {
    VERSION: VERSION, parseJson: parseJson, parseBarState: parseBarState, isTakeover: isTakeover,
    needsYouSession: needsYouSession, buttonState: buttonState, buttonDispatches: buttonDispatches,
    rowDispatches: rowDispatches, recordWorkspace: recordWorkspace, bindsShown: bindsShown,
    showsKey: showsKey, rowShowsKey: rowShowsKey, sessionCount: sessionCount, ariaLabel: ariaLabel, dots: dots,
    elapsed: elapsed, ticks: ticks, checksMarked: checksMarked, footerText: footerText
  }
}
