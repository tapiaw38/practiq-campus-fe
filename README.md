# Practiq Campus Frontend

Practiq Campus frontend for teachers and students, built with Vue 3, TypeScript, Vite, Pinia, and PrimeVue.

## Overview

Practiq Campus covers courses, enrollments, materials, assignments, forums, calendar, and messaging.

The frontend talks to two backend services:

- Auth API: authentication, users, roles, and password flows.
- Campus API: campus academic data (courses, enrollments, materials, assignments, forums, calendar, messages).

## Requirements

- Node.js 18+
- npm
- Auth API running on `http://localhost:8082`
- Campus API running on `http://localhost:8084`

## Environment

Copy the example environment file:

```bash
cp .env.example .env
```

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_AUTH_API_URL` | Auth API base URL | `http://localhost:8082` |
| `VITE_CAMPUS_API_URL` | Campus API base URL | `http://localhost:8084` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | none |

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

The Vite development server runs at `http://localhost:5175`.

When running through the root Docker Compose stack:

```text
http://campus.practiq.localhost
```

## Production Build

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Project Structure

```text
practiq-campus-fe/
├── src/
│   ├── api/request/          # Axios instances and token helpers
│   ├── assets/               # Global CSS and theme tokens
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   ├── router/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── views/
├── public/
├── index.html
└── vite.config.ts
```

## Tech Stack

- Vue 3 with Composition API and `<script setup>`
- TypeScript
- Vite
- Pinia
- Vue Router
- Axios
- PrimeVue 4 and PrimeIcons
