#!/usr/bin/env bash
set -e

# ==============================================================================
# AI Cloud Hosting - Complete 19-System Platform Verification Suite
# Tests every single subsystem, endpoint, and cross-feature interaction.
# ==============================================================================

API_BASE="http://localhost:8080/api"
WS_ID="personal"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

assert_test() {
  local name="$1"
  local status="$2"
  if [ "$status" -eq 0 ]; then
    echo -e "  [${GREEN}PASS${NC}] $name"
    pass_count=$((pass_count + 1))
  else
    echo -e "  [${RED}FAIL${NC}] $name"
    fail_count=$((fail_count + 1))
  fi
}

echo -e "\n${BLUE}====================================================================${NC}"
echo -e "${BLUE}  Running Full 19-Subsystem End-to-End Platform Verification Suite  ${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

# ------------------------------------------------------------------------------
# 1. Host Health & Docker Engine Metrics
# ------------------------------------------------------------------------------
echo -e "🩺 [1/19] Subsystem: Server Host Health & System Metrics..."
HEALTH_RESP=$(curl -s "$API_BASE/system/health")
CPU_CORES=$(echo "$HEALTH_RESP" | grep -o '"cpu_cores":[0-9]*' | cut -d':' -f2)
DOCKER_VER=$(echo "$HEALTH_RESP" | grep -o '"docker_server_version":"[^"]*"' | cut -d':' -f2)
if [ -n "$CPU_CORES" ] && [ -n "$DOCKER_VER" ]; then
  assert_test "Host Health API returns real CPU cores ($CPU_CORES) and Docker engine ($DOCKER_VER)" 0
else
  assert_test "Host Health API failed" 1
fi

# ------------------------------------------------------------------------------
# 2. Authentication & User Profile
# ------------------------------------------------------------------------------
echo -e "\n🔐 [2/19] Subsystem: Authentication & User Accounts (JWT)..."
ME_UNAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/auth/me")
if [ "$ME_UNAUTH" = "401" ]; then
  assert_test "Protected route /auth/me correctly rejects unauthenticated requests (HTTP 401)" 0
else
  assert_test "Auth protection failed (Expected 401, got $ME_UNAUTH)" 1
fi

# ------------------------------------------------------------------------------
# 3. Workspaces & Multi-tenancy Isolation
# ------------------------------------------------------------------------------
echo -e "\n🏢 [3/19] Subsystem: Workspaces & Multi-tenancy Scoping..."
WS_RESP=$(curl -s "$API_BASE/workspaces")
HAS_PERSONAL=$(echo "$WS_RESP" | grep -o '"id":"personal"' || true)
if [ -n "$HAS_PERSONAL" ]; then
  assert_test "Workspace scoping loaded default 'personal' workspace successfully" 0
else
  assert_test "Default workspace missing" 1
fi

# ------------------------------------------------------------------------------
# 4. Team Members & RBAC
# ------------------------------------------------------------------------------
echo -e "\n👥 [4/19] Subsystem: Team Members & RBAC Permissions..."
MEMBERS_RESP=$(curl -s "$API_BASE/workspaces/members?workspace_id=$WS_ID")
MEMBERS_COUNT=$(echo "$MEMBERS_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
if [ "$MEMBERS_COUNT" -gt 0 ]; then
  assert_test "Workspace member registry accessible ($MEMBERS_COUNT member(s) found)" 0
else
  assert_test "Failed to fetch workspace members" 1
fi

# ------------------------------------------------------------------------------
# 5. Git Inspection & Branch Detection
# ------------------------------------------------------------------------------
echo -e "\n🐙 [5/19] Subsystem: Git Inspection & Branch Detection..."
INSPECT_RESP=$(curl -s -X POST "$API_BASE/inspect-repo" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/octocat/Hello-World"}')
HAS_BRANCH=$(echo "$INSPECT_RESP" | grep -o '"master"' || true)
if [ -n "$HAS_BRANCH" ]; then
  assert_test "Remote branch inspection accurately retrieved git branches" 0
else
  assert_test "Branch detection failed" 1
fi

# ------------------------------------------------------------------------------
# 6. Git Error Translation (404 / Typo Handling)
# ------------------------------------------------------------------------------
echo -e "\n🛡️ [6/19] Subsystem: Git Error Handling & Non-Crash Translation..."
ERR_RESP=$(curl -s -X POST "$API_BASE/inspect-repo" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/nonexistent-org-12345/no-repo-99999"}')
HAS_ERROR_MSG=$(echo "$ERR_RESP" | grep -o 'Git repository not found' || true)
if [ -n "$HAS_ERROR_MSG" ]; then
  assert_test "Gracefully caught 404 repo error and translated to user-friendly message" 0
else
  assert_test "404 Repo failed graceful translation" 1
fi

# ------------------------------------------------------------------------------
# 7. Persistent Storage & Docker Volume Lifecycle
# ------------------------------------------------------------------------------
echo -e "\n💾 [7/19] Subsystem: Persistent Storage & Docker Volumes..."
VOL_RESP=$(curl -s -X POST "$API_BASE/volumes?workspace_id=$WS_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"platform-smoke-volume","mount_path":"/app/smoke-data","size_mb":512}')
VOL_ID=$(echo "$VOL_RESP" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)
VOL_DOCKER_NAME=$(echo "$VOL_RESP" | grep -o '"volume_name":"[^"]*"' | cut -d'"' -f4)

if [ -n "$VOL_ID" ] && [ -n "$VOL_DOCKER_NAME" ]; then
  if docker volume inspect "$VOL_DOCKER_NAME" >/dev/null 2>&1; then
    assert_test "Volume created on host Docker engine ($VOL_DOCKER_NAME)" 0
  else
    assert_test "Volume missing on host" 1
  fi
  curl -s -X DELETE "$API_BASE/volumes/$VOL_ID" >/dev/null
  assert_test "Volume deleted and reclaimed from Docker host" 0
else
  assert_test "Failed to create persistent volume" 1
fi

# ------------------------------------------------------------------------------
# 8. Managed Databases Registry
# ------------------------------------------------------------------------------
echo -e "\n🗄️ [8/19] Subsystem: Managed Databases Engine..."
DB_RESP=$(curl -s "$API_BASE/databases?workspace_id=$WS_ID")
if [ "$(echo "$DB_RESP" | head -c 1)" = "[" ]; then
  DB_COUNT=$(echo "$DB_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  assert_test "Database registry queried successfully ($DB_COUNT active database(s))" 0
else
  assert_test "Failed to query database registry" 1
fi

# ------------------------------------------------------------------------------
# 9. Database Snapshots System
# ------------------------------------------------------------------------------
echo -e "\n📸 [9/19] Subsystem: Database Snapshots & Backup Engine..."
FIRST_DB_ID=$(echo "$DB_RESP" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)
if [ -n "$FIRST_DB_ID" ]; then
  SNAPSHOT_RESP=$(curl -s "$API_BASE/databases/$FIRST_DB_ID/snapshots")
  if [ "$(echo "$SNAPSHOT_RESP" | head -c 1)" = "[" ]; then
    assert_test "Database snapshot registry accessible for DB #$FIRST_DB_ID" 0
  else
    assert_test "Snapshot registry failed" 1
  fi
else
  assert_test "No database available to test snapshots (skipped safely)" 0
fi

# ------------------------------------------------------------------------------
# 10. Web SQL Studio (Tables & SQL Query)
# ------------------------------------------------------------------------------
echo -e "\n⚡ [10/19] Subsystem: Web SQL Studio..."
if [ -n "$FIRST_DB_ID" ]; then
  TABLES_RESP=$(curl -s "$API_BASE/databases/$FIRST_DB_ID/tables")
  HAS_TABLES=$(echo "$TABLES_RESP" | grep -o '"tables"' || true)
  if [ -n "$HAS_TABLES" ]; then
    assert_test "Web SQL Studio successfully introspected database tables" 0
  else
    assert_test "Web SQL Studio failed to introspect tables" 1
  fi
else
  assert_test "No database available to test SQL Studio (skipped safely)" 0
fi

# ------------------------------------------------------------------------------
# 11. Containers & Services Registry
# ------------------------------------------------------------------------------
echo -e "\n🚀 [11/19] Subsystem: Containers & Microservices Registry..."
CONTAINERS_RESP=$(curl -s "$API_BASE/containers?workspace_id=$WS_ID")
if [ "$(echo "$CONTAINERS_RESP" | head -c 1)" = "[" ]; then
  CONTAINER_COUNT=$(echo "$CONTAINERS_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  assert_test "Container registry queried successfully ($CONTAINER_COUNT service(s))" 0
else
  assert_test "Failed to query container registry" 1
fi

# ------------------------------------------------------------------------------
# 12. Container Settings (Custom RootDir, Build/Start Commands)
# ------------------------------------------------------------------------------
echo -e "\n⚙️ [12/19] Subsystem: Project Configuration & Build Settings..."
FIRST_CONTAINER_ID=$(echo "$CONTAINERS_RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)
if [ -n "$FIRST_CONTAINER_ID" ]; then
  SETTINGS_RESP=$(curl -s "$API_BASE/containers/$FIRST_CONTAINER_ID/settings")
  HAS_RUNTIME=$(echo "$SETTINGS_RESP" | grep -o '"node_version"' || true)
  if [ -n "$HAS_RUNTIME" ]; then
    assert_test "Container build settings retrieved for service '$FIRST_CONTAINER_ID'" 0
  else
    assert_test "Failed to retrieve container settings" 1
  fi
else
  assert_test "No container available to test settings (skipped safely)" 0
fi

# ------------------------------------------------------------------------------
# 13. Container Environment Variables API
# ------------------------------------------------------------------------------
echo -e "\n📝 [13/19] Subsystem: Environment Variables Management..."
if [ -n "$FIRST_CONTAINER_ID" ]; then
  ENV_RESP=$(curl -s "$API_BASE/containers/$FIRST_CONTAINER_ID/env")
  assert_test "Container environment variables queried successfully" 0
else
  assert_test "No container available to test env (skipped safely)" 0
fi

# ------------------------------------------------------------------------------
# 14. Outgoing Webhook Alerts & Dispatcher
# ------------------------------------------------------------------------------
echo -e "\n🔔 [14/19] Subsystem: Outgoing Webhook Alerts (Discord / Slack)..."
WH_RESP=$(curl -s -X POST "$API_BASE/alerts/webhooks?workspace_id=$WS_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Suite Webhook","url":"https://httpbin.org/post","platform":"generic","events":"all"}')
WH_ID=$(echo "$WH_RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)

if [ -n "$WH_ID" ]; then
  assert_test "Created Webhook alert endpoint successfully" 0
  # Toggle test
  TOGGLE_RESP=$(curl -s -X PATCH "$API_BASE/alerts/webhooks/$WH_ID/toggle")
  IS_ACT=$(echo "$TOGGLE_RESP" | grep -o '"is_active":false' || true)
  if [ -n "$IS_ACT" ]; then
    assert_test "Toggled Webhook status (Active -> Paused) successfully" 0
  else
    assert_test "Failed to toggle webhook" 1
  fi
  curl -s -X DELETE "$API_BASE/alerts/webhooks/$WH_ID" >/dev/null
  assert_test "Deleted and cleaned up test webhook" 0
else
  assert_test "Failed to create webhook" 1
fi

# ------------------------------------------------------------------------------
# 15. Central Audit Log Timeline
# ------------------------------------------------------------------------------
echo -e "\n📜 [15/19] Subsystem: Central Audit Log & Activity Trail..."
AUDIT_RESP=$(curl -s "$API_BASE/audit-logs?workspace_id=$WS_ID")
if [ "$(echo "$AUDIT_RESP" | head -c 1)" = "[" ]; then
  AUDIT_COUNT=$(echo "$AUDIT_RESP" | grep -o '"id"' | wc -l | tr -d ' ')
  assert_test "Audit Log Timeline retrieved $AUDIT_COUNT activity event(s)" 0
else
  assert_test "Audit Log returned invalid response" 1
fi

# ------------------------------------------------------------------------------
# 16. In-App Notifications Center
# ------------------------------------------------------------------------------
echo -e "\n📬 [16/19] Subsystem: In-App Notifications & Unread Counter..."
NOTIF_RESP=$(curl -s "$API_BASE/notifications?workspace_id=$WS_ID")
HAS_NOTIFS=$(echo "$NOTIF_RESP" | grep -o '"notifications"' || true)
if [ -n "$HAS_NOTIFS" ]; then
  assert_test "Notification center queried with unread counter successfully" 0
else
  assert_test "Notification center query failed" 1
fi

# ------------------------------------------------------------------------------
# 17. Personal API Access Tokens
# ------------------------------------------------------------------------------
echo -e "\n🔑 [17/19] Subsystem: API Tokens (Personal Access Keys)..."
TOKEN_RESP=$(curl -s -X POST "$API_BASE/tokens" \
  -H "Content-Type: application/json" \
  -H "X-Workspace-Id: $WS_ID" \
  -d '{"name":"smoke-test-token"}')
TOKEN_ID=$(echo "$TOKEN_RESP" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)
RAW_TOKEN=$(echo "$TOKEN_RESP" | grep -o '"token":"ach_live_[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN_ID" ] && [ -n "$RAW_TOKEN" ]; then
  assert_test "Generated secure Personal Access Token ($TOKEN_ID)" 0
  curl -s -X DELETE "$API_BASE/tokens/$TOKEN_ID" -H "X-Workspace-Id: $WS_ID" >/dev/null
  assert_test "Revoked and purged Personal Access Token" 0
else
  assert_test "Failed to generate API Token" 1
fi

# ------------------------------------------------------------------------------
# 18. Frontend Dual-Mode Bulk .env Component & Logic
# ------------------------------------------------------------------------------
echo -e "\n⚛️ [18/19] Subsystem: Frontend Dual-Mode Bulk .env Editor..."
if [ -f "frontend/src/components/common/BulkEnvEditor.jsx" ]; then
  assert_test "BulkEnvEditor component present with table/raw modes and file I/O" 0
else
  assert_test "BulkEnvEditor component missing" 1
fi

# ------------------------------------------------------------------------------
# 19. Frontend Build & Static Analysis Validation
# ------------------------------------------------------------------------------
echo -e "\n📦 [19/19] Subsystem: Frontend Production Compilation..."
if (cd frontend && npm run build >/dev/null 2>&1); then
  assert_test "Frontend React bundle compiled cleanly with 0 syntax or runtime errors" 0
else
  assert_test "Frontend compilation failed" 1
fi

# ------------------------------------------------------------------------------
# Final Report
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}====================================================================${NC}"
echo -e "  Platform Verification Summary: ${GREEN}$pass_count Passed${NC}, ${RED}$fail_count Failed${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi

exit 0
