# git Commits messages

**absolutely do not use any coauthred by or any trailer messages in any commit messages**
Format: `<type>(<scope>): <short 1 line description and optionally folowed by few bullet points 1liners for details>`

Examples:

- `feat(corehr): add service observability and error handling`
- `fix(api): align default token reader with auth storage key`
- `refactor(auth): switch auth-service to @repo/api client`

Rules:

- small, logically separated commits
- short, clear, imperative description
- precise lowercase scope
- add `(#N)` only if the commit clearly maps to an issue
- describe only the implemented technical or product change and its effect
- never mention OpenSpec, agents, AI tools, prompts, skills, local planning phases, packets, or other local-workflow terminology

Commit types:

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`

IMPORTANT do not track anything inside C:\Code\EY\Fusion\.vscode

IMPORTANT never commit local or debugging artifacts — delete them before committing. This includes QA/verification screenshots (e.g. stray `.png` files), scratch scripts, captured tool/log output, and transient generated files such as `next-env.d.ts` dev-output flips (`.next-dev` ↔ `.next`). Only source, tests, and real config belong in a commit.
