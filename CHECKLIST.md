# Manual checklist

Quickshell gives a test no way to read a widget's state, so a person runs these checks on a live desktop and compares each one with the bar widget canvas (https://claude.ai/artifact/N8B6hNpFGfJBN6V8F4MehZ).

## Before you start

- The widget is installed and enabled. Nothing in this checklist installs it, since only you edit `shell.json`.
- keek's daemon is running. Start it from Hyprland.
- To see the shortcuts in the list, add the Super F1 to F4 binds from keek's `docs/viewer.md`, add your own Super+Shift+K bind that switches to `name:keek` (keek documents none), and reload Hyprland.
- Note your active workspace, focus and open windows, so you can leave them as they were.

## Checks

- [ ] **No sessions: hidden.** With no session on the keek workspace, there is no keek button and no gap where it would be. `$XDG_RUNTIME_DIR/keek/bar.json` is absent.
- [ ] **Two sessions: two dots.** Open two sessions. The button shows the outline glyph and two dots, each in its session's cursor colour, on the occupied-pill background.
- [ ] **On keek: highlighted.** Click the button from workspace 2. The bar switches to `keek`, and the button shows the active-pill background and the filled glyph.
- [ ] **On keek: back.** Click the button again. The bar returns to workspace 2, not to `keek-rail`. Repeat after Super F2 swaps a session in from the rail: the click still returns to workspace 2. With two monitors, focus a workspace on the other monitor by moving the pointer or with a monitor bind, then switch to `keek`: the click returns to that workspace.
- [ ] **On keek with no recorded workspace.** Switch to `keek`, run `omarchy restart shell` there, and click the button. The bar goes to workspace 1.
- [ ] **Help Request: orange.** Have a Verifier call `request_help`. The button turns orange (`#fba35e`) with dark text and "Needs you", and the waiting session's dot gets a white ring. The widget does not switch workspace on its own.
- [ ] **Help Request: a click shows that session.** From another workspace, click the orange button. The bar switches to `keek` and the waiting session moves to the focus slot.
- [ ] **Help Request on keek: a click shows that session.** On `keek`, with another session in the focus slot, click the orange button. The bar stays on `keek` and the waiting session moves to the focus slot; it does not go back to the previous workspace.
- [ ] **Takeover: inert.** Press Take control. The button shows the active-pill background and filled glyph, the pointer stays an arrow, and a click does nothing. Hover it: the rows are dimmed, a click on a row does nothing, and the list reads "Sessions unlock when you press Done." Step away and check the same while the Takeover is paused. Press Done: the button works again.
- [ ] **Ended session: ring.** Let a session end. Its dot turns into a ring in its colour, and its row shows the Verdict with no clock.
- [ ] **Hover list.** Hover the button. After a moment a list opens under it with one row per session: glyph in the cursor colour, Project, branch, elapsed time, state line, "N of M" with one tick per Check, "in focus" on the focus-slot session, and Super F<n> when that bind exists and you are on `keek`. Super+Shift+K shows in the header only when that bind exists.
- [ ] **Super F keys only on keek.** Hover the button on `keek`: each row shows its Super F<n>. Hover it from workspace 2: no row shows a Super F key, while Super+Shift+K stays in the header. The elapsed time counts up while the list is open.
- [ ] **Hover list: a row click.** From another workspace, click a row. The bar switches to `keek` and that session moves to the focus slot. The list closes.
- [ ] **Hover list: dismiss.** Move the pointer from the button into the list: it stays open. Move it off both: it closes within a fraction of a second.
- [ ] **Shortcuts follow the binds.** On `keek`, remove the Super F3 bind and reload Hyprland. Super F3 disappears from row 3 without a shell restart.
- [ ] **Toast icon.** Raise a Help Request. The notification shows the keek logo in its icon slot, not a letter or the default glyph.
- [ ] **Accessibility.** With a screen reader or an accessibility inspector, the button reads "keek, 2 sessions. Show the keek workspace." off keek, "Go back to the previous workspace." on keek, and "keek, 2 sessions, one needs you. Show it." during a Help Request.
- [ ] **Shell start before keek.** Log in fresh, so `$XDG_RUNTIME_DIR/keek` doesn't exist yet, and open a session before anything else starts keek. The button appears without a shell restart.

## After

- Close the sessions. The button disappears.
- Return to the workspace, focus and windows you noted.
