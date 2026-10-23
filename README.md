# ☁️ AI Cloud Hosting (PaaS)

<p align="center">
  <strong>Next-Generation AI-Powered Platform-as-a-Service (PaaS)</strong><br />
  <em>The developer experience of Vercel, the self-hosting freedom of Coolify, and the database ergonomics of Supabase.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Verification_Suite-23%2F23_PASS-10b981?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Verification Suite" />
  <img src="https://img.shields.io/badge/Golang-1.22+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Docker-Engine_29+-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75C2?style=for-the-badge&logo=google&logoColor=white" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/License-MIT-gray?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <a href="https://ai-cloud-hosting.vercel.app"><strong>🌐 Live Dashboard (Vercel)</strong></a> •
  <a href="#-architecture"><strong>🏗️ Architecture</strong></a> •
  <a href="#-key-features"><strong>✨ Features</strong></a> •
  <a href="#-quick-start-guide"><strong>🚀 Quick Start</strong></a> •
  <a href="#-rest-api-reference"><strong>📡 API Reference</strong></a>
</p>

---

## 📖 Overview

**AI Cloud Hosting** is an open-source, developer-first **Platform-as-a-Service (PaaS)** built for modern self-hosting on cloud virtual machines (Azure, AWS, DigitalOcean) or bare-metal servers. It automates container builds, multi-framework monorepo deployments, managed database provisioning, automated snapshot backups, and persistent storage — completely eliminating hardcoded environments and vendor lock-in.

Powered by **Google Gemini 2.5 Flash**, the platform autonomously inspects raw Git repositories, identifies project architectures, synthesizes production-grade Dockerfiles, and manages dynamic Traefik reverse-proxy routing without requiring manual `docker-compose.yml` boilerplate from the developer.

---

## 🏗 System Architecture

The platform follows a decoupled, resilient architecture designed for high availability and zero-touch continuous deployment:

```
               ┌────────────────────────┐      ┌────────────────────────┐
               │    Frontend UI         │      │     Backend API        │
               │  (React 19 + Vite)     │◄────►│   (Golang 1.22 + Gin)  │
               │   Hosted on Vercel     │      │   Hosted on Azure VM   │
               └────────────────────────┘      └───────────┬────────────┘
                                                           │
                                ┌──────────────────────────┼──────────────────────────┐
                                │                          │                          │
                                ▼                          ▼                          ▼
                     ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
                     │   Docker Engine    │     │   Gemini AI API    │     │  Primary Postgres  │
                     │  (Container SDK)   │     │ (Dockerfile Gen)   │     │ (GORM & Metadata)  │
                     └─────────┬──────────┘     └────────────────────┘     └────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────┐
│  Deployed App Pods   │              │  Managed Postgres DB │
│ (Nginx / Node / Go)  │              │ (Automated Snapshots)│
└──────────┬───────────┘              └──────────────────────┘
           │
           ▼
┌──────────────────────┐
│   Traefik v3 Proxy   │◄────────────── Dynamic Router Sync Daemon
│ (Reverse Gateway :80)│
└──────────────────────┘
```

---

## ✨ Key Features & Capabilities

### 1. 🤖 AI-Powered Intelligent Deployments
- **Zero-Config Monorepo & Single-Repo Support:** Intelligently detects React, Vite, Next.js, Nuxt 3, Vue, Node.js, Golang, Python, FastAPI, and more. Automatically provisions separate microservices for frontend and backend in fullstack repositories.
- **Dynamic Dockerfile Synthesis:** Gemini AI inspects dependencies and synthesizes optimized, multi-stage production Dockerfiles and Nginx reverse proxies on the fly.
- **Git Push Webhooks & Auto-Deploy:** Full GitHub push webhook integration (`/api/webhooks/deploy/:id`) with HMAC SHA-256 signature verification for zero-touch CI/CD.
- **Rollback Engine & Release History:** Immutable deployment release history with instant zero-downtime rollback to any prior release version.

### 2. 🗄️ Managed Databases & Web SQL Studio
- **On-Demand PostgreSQL 16 Instances:** Provision isolated database containers in seconds with automatic port allocation and secure credentials.
- **Automated Point-in-Time Snapshots:** Create binary database dumps (`.dump` / `.sql`) on demand, download backups, or perform one-click state restoration.
- **Built-in Web SQL Studio:** Native schema introspection, table structure inspection, and interactive SQL query runner right inside the browser.

### 3. 💾 Persistent Storage & Docker Volumes
- **Host-Level Volume Provisioning:** Manage Docker volumes directly from the UI with real-time mount tracking and container association.
- **Host Reclamation:** Detect orphaned storage volumes and safely prune or reclaim host disk space.

### 4. 🏢 Multi-Tenancy & Workspaces
- **Workspace Scoping:** All resources (deployments, databases, volumes, tokens) are strictly isolated by `X-Workspace-Id`.
- **4-Tier RBAC:** Granular role-based access control (`Owner`, `Admin`, `Member`, `Viewer`) with audit trail logging for security compliance.

### 5. 🎨 Developer Experience (Vercel-Inspired UI)
- **Minimalist Dark Aesthetics:** Sleek `#000000` / `#0a0a0a` theme with high-contrast typography and subtle ambient accents.
- **Real-Time Log Streaming:** Live server-sent build and deployment logs with intelligent root-cause error extraction.
- **Bulk `.env` Management:** Key-value table editor with 1-click database connection injection (`DATABASE_URL`).

---

## 🛠 Tech Stack

| Layer | Technologies & Tools |
|---|---|
| **Frontend** | React 19, Vite 8, Tailwind CSS, Lucide React, Zustand, Sonner Toasts |
| **Backend** | Go (Golang) 1.22+, Gin Web Framework, GORM ORM, Docker Go SDK, JWT v5, gopsutil |
| **Database** | PostgreSQL 16 (Platform Metadata & Managed Database Containers) |
| **Reverse Proxy** | Traefik v3 Dynamic Reverse Proxy, Nginx (container internal routing) |
| **AI Inference** | Google Gemini 2.5 Flash API |
| **Deployment** | Vercel (Edge Frontend), Azure Virtual Machines (Compute & Docker Daemon) |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Go 1.22+](https://go.dev/dl/) installed
- [Node.js 18+](https://nodejs.org/) and `npm` installed
- [Docker Engine](https://docs.docker.com/engine/install/) & Docker CLI running
- PostgreSQL instance running locally or in the cloud (e.g. Supabase, Render, Azure)

---

### 1. Clone Repository
```bash
git clone https://github.com/thanawat-c/ai-cloud-hosting.git
cd ai-cloud-hosting
```

---

### 2. Configure Backend Environment
Copy the environment template and fill in your credentials:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```ini
PORT=8080
DB_URL=host=localhost user=postgres password=postgres dbname=ai_cloud_db port=5432 sslmode=disable
GEMINI_API_KEY=your_gemini_api_key_here
DOCKER_HOST=unix:///var/run/docker.sock
JWT_SECRET=your_super_secret_jwt_key
APP_DOMAIN_SUFFIX=20.48.16.226.nip.io
```

Run the backend server:
```bash
cd backend
go run main.go
```
*The backend automatically runs GORM migrations, seeds the initial admin user (`admin@aicloud.dev` / `admin1234`), and launches the Traefik route sync daemon.*

---

### 3. Configure Frontend Environment
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:5173`.  
Log in with default credentials:
- **Email:** `admin@aicloud.dev`
- **Password:** `admin1234`

---

## 🧪 Comprehensive Verification Suite

The repository includes an end-to-end automated verification script covering **all 19 subsystems** and 23 platform assertions:

```bash
./scripts/verify_features.sh
```

### Verified Subsystems:
1. `[PASS]` Server Host Health & System Metrics
2. `[PASS]` Authentication & User Accounts (JWT)
3. `[PASS]` Workspaces & Multi-tenancy Scoping (`X-Workspace-Id`)
4. `[PASS]` Team Members & 4-Tier RBAC Permissions
5. `[PASS]` Git Inspection & Remote Branch Detection
6. `[PASS]` Git Error Handling & Non-Crash Translation
7. `[PASS]` Persistent Storage & Host Docker Volumes
8. `[PASS]` Managed Databases Engine
9. `[PASS]` Database Snapshots & Backup Engine
10. `[PASS]` Web SQL Studio & Schema Introspection
11. `[PASS]` Containers & Microservices Registry
12. `[PASS]` Project Configuration & Build Settings
13. `[PASS]` Environment Variables Management
14. `[PASS]` Outgoing Webhook Alerts (Discord / Slack)
15. `[PASS]` Central Audit Log & Activity Trail
16. `[PASS]` In-App Notifications & Unread Counter
17. `[PASS]` API Tokens (Personal Access Keys)
18. `[PASS]` Frontend Dual-Mode Bulk `.env` Editor
19. `[PASS]` Frontend Production Compilation (`npm run build`)

---

## 📡 REST API Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new account | No |
| `POST` | `/api/auth/login` | Login and receive JWT token | No |
| `GET` | `/api/auth/me` | Retrieve authenticated user profile | Bearer Token |
| `GET` | `/api/workspaces` | List accessible workspaces | Bearer Token |
| `POST` | `/api/inspect-repo` | Inspect remote Git repository & branches | Bearer Token |
| `POST` | `/api/test-deploy` | Trigger single-repo or monorepo deployment | Bearer Token |
| `GET` | `/api/containers` | List all running service containers | Bearer Token |
| `POST` | `/api/containers/:id/stop` | Stop running container | Bearer Token |
| `POST` | `/api/containers/:id/start`| Start stopped container | Bearer Token |
| `DELETE`| `/api/containers/:id` | Purge container and Traefik routes | Bearer Token |
| `GET` | `/api/databases` | List managed database instances | Bearer Token |
| `POST` | `/api/databases` | Provision new managed PostgreSQL DB | Bearer Token |
| `POST` | `/api/databases/:id/snapshots` | Take point-in-time database snapshot | Bearer Token |
| `POST` | `/api/databases/:id/restore` | Restore database from snapshot | Bearer Token |
| `GET` | `/api/volumes` | List Docker persistent storage volumes | Bearer Token |
| `POST` | `/api/volumes` | Create persistent Docker storage volume | Bearer Token |
| `GET` | `/api/system/health` | Real-time host CPU/RAM/Disk metrics | Bearer Token |
| `POST` | `/api/system/prune` | Prune dangling images and build cache | Bearer Token |
| `GET` | `/api/audit-logs` | Retrieve platform activity trail | Bearer Token |
| `POST` | `/api/alerts/webhooks` | Register outgoing Discord/Slack webhook | Bearer Token |
| `POST` | `/api/webhooks/deploy/:id`| GitHub push event deployment webhook | Secret / Signature |

---

## 🔒 Security Best Practices

- **Zero Hardcoding Policy:** All hosts, ports, tokens, and endpoints are derived dynamically from environment variables or request headers.
- **Tenant Isolation:** Every request to resource endpoints validates `X-Workspace-Id` against the user's membership.
- **Input Sanitization:** Git URLs, branches, environment keys, and SQL queries are thoroughly sanitized to prevent injection.
- **Secret Obfuscation:** Database passwords and sensitive credentials are encrypted and omitted from client-side network payloads.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
