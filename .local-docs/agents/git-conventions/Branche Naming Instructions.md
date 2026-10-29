# Branches

Format: `<type>/<scope>-<short-kebab-description>`

Examples:

- `feature/corehr-data-layer`
- `fix/backend-dev-ports`
- `refactor/auth-api-alignment`

Rules:

- one branch = one concern = one PR
- lowercase only
- kebab-case after `/`
- keep short and specific
- use clear scope names: `auth`, `api`, `corehr`, `backend`, etc.
- describe the technical or product concern only
- never use OpenSpec, agent, AI-tool, prompt, skill, packet, phase, or other local-workflow terminology

Branch types:

- `feature` = new functionality
- `fix` = bug fix
- `refactor` = internal code change without behavior change
- `docs` = documentation only
- `test` = tests only
- `chore` = maintenance / tooling / cleanup
