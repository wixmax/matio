# Development Workflow

## 1. How work is organized

- The **technical architect** defines one task at a time and reviews the result.
- The **implementation agent** executes only that task, verifies it, and reports back.
- Tasks are incremental. A task may build on the previous one but may not silently expand scope.
- The repository must stay runnable at the end of every task.

## 2. Start-of-task checklist

1. Read `AGENTS.md` and the docs relevant to the task (`docs/ARCHITECTURE.md` is almost always
   relevant; add `LEVEL_FORMAT.md`, `ASSET_GUIDE.md` or `GAME_DESIGN.md` as needed).
2. Inspect the working tree: `git status`, recent changes, and any files the user may have edited.
3. Confirm the app still works before changing it (`npm run typecheck`, `npm run test`,
   `npm run dev` if the change is visual).
4. Write down the acceptance criteria implied by the task, including what is out of scope.
5. Check Phaser 4 APIs before using them: `node_modules/phaser/types/phaser.d.ts` or
   `node_modules/phaser/skills/<topic>/SKILL.md`. Do not copy Phaser 3 code from memory.

## 3. Implementation loop

```text
read docs -> plan -> inspect -> small change -> typecheck -> test -> build -> verify in browser -> report
```

Rules of thumb:

- Prefer the smallest change that satisfies the task.
- Keep scenes thin: wiring, lifecycle, camera; push rules into systems and behavior into entities.
- Never hardcode a level layout in a scene. Scene presentation constants (ground band, camera
  framing) are acceptable; level content is not.
- Add a module only when a second caller exists or the task explicitly requires it. No speculative
  interfaces, base classes or plugin systems.
- If a requirement is ambiguous or blocked, report it instead of inventing a workaround.
- Do not "fix" unrelated code while implementing a task. Note it for review instead.

## 4. Commands

| Command | When |
| --- | --- |
| `npm run dev` | Every visual/input change; verify in a real browser |
| `npm run typecheck` | After every TypeScript change |
| `npm run test` | After logic/content changes, and before handoff |
| `npm run build` | Before handoff, to catch bundling and config issues |
| `npm run preview` | To sanity-check the production bundle if needed |

The dev server uses port **5173** with `strictPort`. If the port is taken, stop the other process
instead of changing the port, so review instructions remain stable.

## 5. Coding standards

### TypeScript

- `strict` is on, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`,
  `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`.
- `any` is forbidden unless it is the only honest representation of an external value; a comment
  explaining why is mandatory. Prefer `unknown` plus narrowing.
- No non-null assertions on values that can actually be absent. Where validation guarantees
  presence, keep the invariant local and document it.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- `satisfies`/discriminated unions are preferred over enums and casts.
- Public functions get explicit return types when inference is not obvious.

### Naming and structure

- Files: PascalCase for classes/scenes/components (`GameScene.ts`, `TextButton.ts`), kebab-case for
  utility modules (`level-validator.ts`, `ui-text.ts`).
- Scenes end with `Scene`; systems are nouns with a clear job; factories end with `Factory`.
- One primary export per file; helpers stay private unless reused.
- Keep files focused. If a file is doing orchestration **and** rules **and** rendering, split it.
- Comments explain **why** (constraints, trade-offs), not what the next line obviously does.

### Phaser 4

- Verify API names and signatures against the bundled types. Phaser 4 is not Phaser 3.
- Do not add custom WebGL pipelines (removed in v4); use filters/render nodes only when required.
- Containers need an explicit hit area for input.
- Clean up scene-level listeners, timers and input bindings on shutdown if they outlive the scene.
- Keep rendering work out of `update()` when it is static; draw once in `create()`.
- Use `this.scale`/`this.cameras` APIs for layout rather than hardcoded device sizes.

### Content and configuration

- Levels live in `content/levels/`; tuning values live in configuration modules/content, never
  inside scene bodies.
- All JSON content passes through `parseLevelJson()`/`validateLevel()` before use.
- Colors and typography come from `src/ui/theme.ts`; do not scatter hex strings.
- Runtime units: pixels per second for speeds and pixels per second² for gravity.

## 6. Testing

### Unit tests (required for logic)

- Location: `tests/*.test.ts`.
- Environment: Node (no DOM). Test pure modules and validators, not Phaser internals.
- Cover the happy path, defaults, boundary values, invalid input and multiple-error behavior.
- Use the real example content where it strengthens the test (the shipped level is validated).

### Manual browser verification

For any scene, layout or input change:

1. `npm run dev`.
2. Open <http://localhost:5173>.
3. Verify the expected flow (currently Boot → Menu → Game).
4. Test mouse **and** touch (device emulation or synthetic touch events).
5. Resize the viewport/window and confirm the 16:9 canvas stays centered without stretching.
6. Check the browser console for errors and the dev error overlay for failures.

Report what was actually observed. "Should work" is not verification. If a check could not run in
the environment, say so explicitly.

## 7. Git conventions

- One task per commit (or a small, clearly described series).
- Commit message: imperative summary plus scope, e.g.
  `feat(foundation): add scene navigation and level contract`.
- Never commit `node_modules/`, `dist/`, `coverage/`, logs or local editor files.
- Do not rewrite or discard the user's uncommitted work. Inspect before staging.
- If a task produces no commit, say so in the report and include `git status`.

## 8. Review checklist

Before handing off, confirm:

- [ ] Scope: only the requested task was implemented.
- [ ] Documentation: relevant docs updated; decisions and deviations recorded.
- [ ] TypeScript: `npm run typecheck` passes.
- [ ] Tests: `npm run test` passes, with new coverage for new logic.
- [ ] Build: `npm run build` succeeds.
- [ ] Runtime: `npm run dev` boots; expected navigation/interaction was observed.
- [ ] Console: no uncaught errors or warnings introduced.
- [ ] Assets: no unapproved art/audio added; naming and grid rules respected.
- [ ] Content: no hardcoded level data; JSON validated.
- [ ] Android/browser: no Node-only APIs, no absolute asset URLs, touch still works.
- [ ] Report: honest about limitations and unverified behavior.

## 9. Handoff report

Every task ends with the mandated report (Arabic when requested) containing execution status,
versions, structure, implementation details, exact commands and results, problems, architecture
notes, readiness for the next task, Git status and a short summary. Include command output evidence
where it matters (test counts, build sizes, console errors).

## 10. Definition of done

A task is done when the requested behavior exists, the checks above pass, the documentation matches
the code, and an independent reviewer can reproduce the result from the report alone.

## 11. Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Blank canvas | Import error or WebGL failure; check console and the dev error overlay |
| `Port 5173 is already in use` | Another dev server is running; stop it |
| Stale modules after refactor | Stop the dev server and restart; delete `node_modules/.vite` if needed |
| Phaser type error after upgrade | API changed between majors; check bundled types in `node_modules/phaser/types` |
| Canvas not centered | Host element has no size; `#game-root` must fill the viewport |
| Touch does nothing | Check `input.touch`, pointer event wiring, and whether another element overlays the canvas |
| JSON validation failure | Read the `path`/`message` pairs; fix the content, never bypass the validator |
