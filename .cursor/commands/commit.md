# Commit changes

Commit staged or unstaged changes following project conventions.

1. **Stage** all relevant files (`git add`).
2. **Run** `npm run test` — fix any failures before committing.
3. **Write** a commit message that explains:
   - **WHAT** changed (brief, imperative)
   - **WHY** it changed (context or rationale)
4. **Include** migration names in the message when schema changed.
5. **Commit** with `git commit -m "..."`.

Format: `type: short summary` (e.g. `feat:`, `fix:`, `perf:`, `docs:`).
