---
name: start-local-dev
description: Deterministically install dependencies if needed and start the Vite dev server for the page. Use when the user asks to run, start, or preview the site locally.
---

# Skill: start-local-dev

Start the local dev server for the single-page site.

## Execution style

This is a **low-freedom skill**: run the steps in order and do not improvise
alternatives.

## Prerequisites

> Requires Node ≥ 20.19 and npm. If unmet, tell the developer and guide setup
> via [`../../context/dev-spec/prerequisites.md`](../../context/dev-spec/prerequisites.md),
> then stop.

## Steps

1. **Check for an existing server.** If the provider has preview tooling that
   lists running servers, or port 5173 is already serving this app, reuse it.
   Don't start a second process (see the conventions in
   [`conventions.md`](../../context/dev-spec/conventions.md)).
2. **Install if needed.** If `node_modules/` is missing or `package.json` is
   newer than `node_modules/.package-lock.json`, run `npm install` from the
   repo root.
3. **Start.**
   - With provider preview tooling: start the `web` configuration from
     [`.claude/launch.json`](../../../.claude/launch.json) (or the provider's
     equivalent).
   - Otherwise: `npm run dev` from the repo root, in the background.
4. **Confirm.** Wait until `http://localhost:5173` responds, then report the
   URL.

## Failure handling

Report the failure and the reason, for example: Node too old, `npm install`
failed (include the error), port already taken by a different app, or Vite
compile error (include the first error lines).
