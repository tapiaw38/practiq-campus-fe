# Practiq Campus FE architecture

## Data flow

Use this flow for every remote domain state:

```text
service -> Pinia store -> composable -> view/component
```

- A service owns HTTP transport only. It receives an API client and returns typed responses.
- A store owns shared remote state, loading state, cache invalidation and optimistic updates.
- A composable creates the service, obtains the store, exposes actions and UI feedback.
- Views and components consume composables. They never instantiate a service or call an API client.
- Do not create a second `ref` copy of data already owned by a store.

## State boundaries

- Store remote data when more than one screen, layout or component can consume it.
- Keep modal visibility, form drafts, animation state and transient selection local to a view/component.
- Do not persist server state in localStorage. Auth bootstrap is the only exception.

## Allowed exceptions

- `authService` may be called by login, token refresh and password flows before an authenticated store exists.

## File layout

```text
src/services/<domain>/<domain>Service.ts
src/stores/<domain>Store.ts
src/composables/use<Domain>.ts
```

- One domain service and one store per remote aggregate.
- Keep request/response types in the service or `src/types` when shared.
- A composable must not duplicate service state with module-level refs; move that state to its store.
- Delete unused composables, services and stores instead of leaving parallel paths.

## Vue components

- Use `<script setup lang="ts">` for every Vue component.
- Keep SFC blocks in this order: `<script setup>`, `<template>`, then `<style>`.
- Define component `Props` and `Emits` in a colocated `ComponentName.types.ts` file.
- Import those contracts with `import type` and pass them to `defineProps` and `defineEmits`.
- Put reusable domain, API and cross-component types in `src/types/<domain>.ts`, not in a component or service.
- Keep component-only props, emits and exposed contracts in the colocated `.types.ts` file.

## Code comments

- Do not add explanatory comments to application code.
- Prefer explicit names, small functions and typed boundaries over comments.
- Keep rationale in documentation or commit messages.
- Exceptions: required legal notices, generated-file directives and tool directives.
