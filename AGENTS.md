# Agent Notes (Teams Library)

- First-party package; you may modify it to enhance reusable team features. Keep code files ≤500 lines each.
- Maintain `CHANGELOG.md` with every update. When changes ship, bump the package version (patch/minor as appropriate) and publish a GitHub release via `gh release create`.
- Keep docs/usage current (`README.md`, `docs/` if present) and update types/exports alongside code changes.
- Prefer small, reusable helpers over duplication; align behavior with other libraries.
- Add or update tests whenever behavior changes.
