# Tablify — Keyboard Shortcuts

Grid shortcuts apply **only when the grid has focus**.

| Shortcut | Action | Notes |
|----------|--------|-------|
| ArrowUp / ArrowDown / ArrowLeft / ArrowRight | Move selection | — |
| Tab / Shift+Tab | Next / Previous cell | — |
| Enter | Edit cell / Commit | Blur also commits |
| Escape | Cancel edit | — |
| Ctrl/Cmd+Z | Undo | Uses P1-05 CommandStack |
| Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y | Redo | — |
| Ctrl/Cmd+C | Copy range | Tab-separated text for spreadsheets |
| Ctrl/Cmd+V | Paste | Tab-separated text |

## Inside the date picker (COD-75)

The card takes the keys while it is open — the same rule as any editor.

| Shortcut | Action | Notes |
|----------|--------|-------|
| Tab / Shift+Tab | Move through the card | Field → month arrows → day grid → hours → minutes → Now → Today → Clear → Done |
| Arrow keys | Move by a day / a week | Crosses month boundaries; the calendar follows |
| PageUp / PageDown | Previous / next month | With Shift: previous / next year |
| Home / End | Start / end of the week | — |
| Enter | Pick the focused day | In the value field, Enter commits the whole card |
| Up / Down in `hh` / `mm` | ±1, wrapping | 23 → 0, 59 → 0 |
| Escape | Close and discard | The cell keeps its value |

## Mouse and touch (SAD-96)

| Gesture | Action | Notes |
|----------|--------|-------|
| Click / tap a cell | Select it | Shift-click extends a range |
| Double-click a cell | Edit it | Opens the editor, option panel, attachment panel, date picker or link picker for the field's type |
| Tap the selected cell again | Edit it | Touch equivalent of double-click |
| Right-click / long-press a cell | Cell menu | **Edit cell** opens the editor from here too |
| Double-click / tap a read-only cell | Nothing | System and formula fields cannot be edited (the menu says why) |

## Overlap with Obsidian defaults

Checked against Obsidian 1.5 hotkeys (desktop):

- `Ctrl/Cmd+Z`, `Shift+Z`, `C`, `V` are standard and overlap is intentional (grid has focus guard via `shouldHandleForGrid`).
- `Tab`, `Enter`, `Escape`, arrows overlap with editor but grid captures only when focused, so no conflict when a note pane is focused.
- No custom hotkey overrides Obsidian's global `Ctrl/Cmd+P` (command palette) — we do not use it.

Recorded 2026-10-09.
