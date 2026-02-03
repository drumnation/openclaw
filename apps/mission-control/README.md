# Gordon Mission Control

Multi-agent command deck for viewing and managing Gordon instances (Day/Dusk/Dawn).

## Features

- **3-panel triptych view** showing all Gordon instances simultaneously
- **Live status indicators** with automatic health checks
- **Per-panel controls** for refresh and open-in-new-tab
- **Responsive layout** adapts from 3-column to 2-column to single-column
- **Dark theme** matching the Clawdbot aesthetic

## Quick Start

```bash
# Development
cd apps/mission-control
pnpm install
pnpm dev

# Production
pnpm build
pnpm serve
```

## Configuration

Default port: `18800`

Tunnel configuration (in `~/.cloudflared/config.yml`):
```yaml
- hostname: gordon.singularity-labs.org
  service: http://localhost:18800
```

## Architecture

Part of the OpenClaw monorepo. Lives at `apps/mission-control/`.

## Instances

| Instance | URL | Host |
|----------|-----|------|
| Day | day.singularity-labs.org | Linux Laptop (Primary) |
| Dusk | dusk.singularity-labs.org | Beelink (Always-On) |
| Dawn | dawn.singularity-labs.org | Gaming PC (Experimental) |
