# Commit Guidelines

## Message Format

1. Title line: `[type] Short subject` limited to 72 characters.
2. Empty line.
3. Optional body wrapped at ~72 characters per line, describing the **why**, impacts, and tests performed.
4. Use bullet points `-` or short paragraphs for the body.

## Allowed Types

- `[feature]`: addition of a feature or API.
- `[fix]`: resolving a user bug or regression.
- `[update]`: minor improvement (UI, content, light configuration).
- `[refactor]`: internal changes without functional impact.
- `[perf]`: performance optimization.
- `[docs]`: documentation or guides only.
- `[test]`: adding/updating tests.
- `[chore]`: maintenance tasks (dependencies, tooling, scripts).
- `[ci]`: CI/CD pipelines, automation, checks.
- `[security]`: security-related fixes or hardening.
- `[revert]`: explicit cancellation of a previous commit (indicate its hash).

## Best Practices

- Prefix each commit with a single type.
- Use the imperative present: "Add", "Fix", "Update".
- When relevant, add a `Tests:` block in the body with the executed commands.
- Avoid commits mixing multiple intentions; split them if necessary.
- Examples:
  - `[feature] Add workspace duplication`
  - `[fix] Fix socket reconnection on timeout`
