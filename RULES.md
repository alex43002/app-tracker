# Rules for Claude

These rules apply to all code changes unless there is a strong technical reason not to follow them. If a rule cannot be followed, explain why in the GitHub PR.

## General Coding Standards

Write code that is simple, readable, and maintainable.

Follow common engineering best practices, including:

* SOLID principles
* DRY, but do not over-abstract too early
* KISS
* Clear separation of concerns
* Small, focused functions and components
* Consistent naming and file organization
* Minimal side effects
* Predictable behavior
* Reusable patterns when they actually make sense

Do not over-engineer the solution. Use common software patterns when they improve clarity, maintainability, or extensibility, but do not force patterns where simple code would be better.

Code should be easy for another developer to understand, review, debug, and safely modify later.

## Comments and Documentation

Comment code when it helps explain intent, trade-offs, edge cases, or non-obvious behavior.

Do not add comments that only repeat what the code already says.

Good comments should explain why something exists, not just what it does.

Update documentation when behavior, setup steps, APIs, configuration, or workflows change.

## Branching Requirements

All work must be done on a separate branch.

Do not make changes directly on `main`, `master`, or any protected branch.

Each branch should have a clear purpose and should be tied to a specific fix, feature, refactor, or task.

## Pull Request Requirements

Every meaningful change must go through a pull request.

The pull request must clearly document:

* What changed
* Why it changed
* How it was tested
* Any trade-offs considered
* Any risks or possible side effects
* Any follow-up work needed

All important comments, decisions, iterations, and trade-offs must be documented in GitHub. Do not leave important reasoning only in local notes or hidden context.

## Testing Requirements

Before opening or finalizing a PR, properly check and test the changes.

Run the relevant tests, linters, type checks, build commands, or manual verification steps for the project.

If a full test suite cannot be run, document why in the PR and explain what was tested instead.

Do not claim that something was tested unless it was actually tested.

## Review Requirements

Before considering a PR done, review the changes as a second pass.

This review must check for:

* Breaking changes
* Bad side effects
* Regression risk
* Unnecessary complexity
* Duplicated logic
* Poor naming
* Missing tests
* Missing documentation
* Security issues
* Performance issues
* Maintainability concerns

After the second-pass review, leave a GitHub comment on the PR summarizing the review.

The comment should mention whether anything risky was found, whether anything still needs attention, and whether the changes look safe to merge.

## Maintainability First

Prefer the simplest solution that fully solves the problem.

Avoid clever code unless there is a clear reason for it.

Make changes that reduce future bugs, make the codebase easier to reason about, and keep the project easier to maintain over time.

When there is a trade-off between cleverness and clarity, choose clarity.
