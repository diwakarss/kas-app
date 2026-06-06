# KAS Website

Next.js landing page for KAS App generation.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Prerequisites

Before running the website, ensure:

1. **Backend is running** (port 7131)

   ```bash
   cd ../backend
   docker compose up -d
   ```

2. **Expo Web Preview is running** (port 19006)
   ```bash
   cd ..
   npm run web:preview
   ```

## Features

- **Generate Form**: Business name + description input
- **Progress Stepper**: SSE-powered real-time progress updates
- **Device Mockup**: Phone frame showing live preview
- **Preview Iframe**: Embedded Expo Web app with spec

## Environment Variables

| Variable                  | Default                  | Description      |
| ------------------------- | ------------------------ | ---------------- |
| `NEXT_PUBLIC_API_URL`     | `http://localhost:7131`  | Backend API      |
| `NEXT_PUBLIC_PREVIEW_URL` | `http://localhost:19006` | Expo Web preview |

## Design System

Uses the "Liquid Story" design tokens:

- **dawn** (#FAF7F2) — Background
- **clay** (#3D3530) — Primary text
- **mist** (#B8AFA6) — Secondary text
- **stream** (#0D47A1) — Primary button
- **ember** (#D4845A) — Error
- **bloom** (#6B9E78) — Success

## Build

```bash
npm run build
npm run start
```
