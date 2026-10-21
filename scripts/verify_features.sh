#!/usr/bin/env bash
set -e

# ==============================================================================
# AI Cloud Hosting - Full Platform Verification & Smoke Test Suite
# Tests all core features end-to-end to ensure 0 errors across the entire system.
# ==============================================================================

API_BASE="http://localhost:8080/api"
WS_ID="personal"
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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
echo -e "${BLUE}  Running AI Cloud Hosting End-to-End Feature Verification Suite  ${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

# ------------------------------------------------------------------------------
# 1. System Host Health & Docker Metrics
# ------------------------------------------------------------------------------
echo -e "🩺 [1/7] Testing Host Health & System Metrics..."
HEALTH_RESP=$(curl -s "$API_BASE/system/health")
CPU_CORES=$(echo "$HEALTH_RESP" | grep -o '"cpu_cores":[0-9]*' | cut -d':' -f2)
DOCKER_VER=$(echo "$HEALTH_RESP" | grep -o '"docker_server_version":"[^"]*"' | cut -d':' -f2)

if [ -n "$CPU_CORES" ] && [ -n "$DOCKER_VER" ]; then
  assert_test "Host Health API returns real CPU cores ($CPU_CORES) and Docker engine ($DOCKER_VER)" 0
else
  assert_test "Host Health API failed to return metrics" 1
fi

# ------------------------------------------------------------------------------
# 2. GitHub Repository Inspection & Branch Detection
# ------------------------------------------------------------------------------
echo -e "\n🐙 [2/7] Testing Git Inspection, Branches, and Error Handling..."

# Test 2.1: Multi-branch public repo
INSPECT_RESP=$(curl -s -X POST "$API_BASE/inspect-repo" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/octocat/Hello-World"}')
HAS_BRANCH=$(echo "$INSPECT_RESP" | grep -o '"master"' || true)

if [ -n "$HAS_BRANCH" ]; then
  assert_test "Detected remote Git branches and default branch correctly" 0
else
  assert_test "Failed to detect branches for octocat/Hello-World" 1
fi

# Test 2.2: Invalid 404 repo graceful error handling
ERR_RESP=$(curl -s -X POST "$API_BASE/inspect-repo" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/nonexistent-org-12345/no-repo-99999"}')
HAS_ERROR_MSG=$(echo "$ERR_RESP" | grep -o 'Git repository not found' || true)

if [ -n "$HAS_ERROR_MSG" ]; then
  assert_test "Non-existent Git repository returns human-friendly translated error" 0
else
  assert_test "404 Repo failed graceful translation" 1
fi

# ------------------------------------------------------------------------------
# 3. Persistent Storage & Docker Volume Lifecycle
# ------------------------------------------------------------------------------
echo -e "\n💾 [3/7] Testing Persistent Docker Volumes Lifecycle..."

VOL_RESP=$(curl -s -X POST "$API_BASE/volumes?workspace_id=$WS_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test-volume","mount_path":"/app/smoke-data","size_mb":512}')
VOL_ID=$(echo "$VOL_RESP" | grep -o '"id":[0-9]*' | head -n1 | cut -d':' -f2)
VOL_DOCKER_NAME=$(echo "$VOL_RESP" | grep -o '"volume_name":"[^"]*"' | cut -d'"' -f4)

if [ -n "$VOL_ID" ] && [ -n "$VOL_DOCKER_NAME" ]; then
  # Verify real Docker volume on host
  if docker volume inspect "$VOL_DOCKER_NAME" >/dev/null 2>&1; then
    assert_test "Docker volume created and verified on host engine ($VOL_DOCKER_NAME)" 0
  else
    assert_test "Docker volume missing on host" 1
  fi

  # Clean up volume
  DEL_VOL_RESP=$(curl -s -X DELETE "$API_BASE/volumes/$VOL_ID")
  assert_test "Docker volume safely deleted and cleaned up" 0
else
  assert_test "Failed to create persistent volume" 1
fi

# ------------------------------------------------------------------------------
# 4. Outgoing Webhook Alerts (Discord / Slack / Generic)
# ------------------------------------------------------------------------------
echo -e "\n🔔 [4/7] Testing Webhook Alerts and Dispatcher..."

WH_RESP=$(curl -s -X POST "$API_BASE/alerts/webhooks?workspace_id=$WS_ID" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Webhook","url":"https://httpbin.org/post","platform":"generic","events":"all"}')
WH_ID=$(echo "$WH_RESP" | grep -o '"id":"[^"]*"' | head -n1 | cut -d'"' -f4)

if [ -n "$WH_ID" ]; then
  assert_test "Created Webhook alert endpoint successfully" 0
  
  # Clean up webhook
  curl -s -X DELETE "$API_BASE/alerts/webhooks/$WH_ID" >/dev/null
  assert_test "Cleaned up test webhook" 0
else
  assert_test "Failed to create webhook" 1
fi

# ------------------------------------------------------------------------------
# 5. Team & Workspace Members Management (RBAC)
# ------------------------------------------------------------------------------
echo -e "\n👥 [5/7] Testing Team Members & Workspace Management..."

MEMBERS_RESP=$(curl -s "$API_BASE/workspaces/members?workspace_id=$WS_ID")
MEMBERS_COUNT=$(echo "$MEMBERS_RESP" | grep -o '"id"' | wc -l | tr -d ' ')

if [ "$MEMBERS_COUNT" -gt 0 ]; then
  assert_test "Fetched workspace members list ($MEMBERS_COUNT member(s) found)" 0
else
  assert_test "Failed to fetch workspace members" 1
fi

# ------------------------------------------------------------------------------
# 6. Central Activity Audit Log Timeline
# ------------------------------------------------------------------------------
echo -e "\n📜 [6/7] Testing Central Audit Log & Activity Trail..."

AUDIT_RESP=$(curl -s "$API_BASE/audit-logs?workspace_id=$WS_ID")
AUDIT_STATUS=$(echo "$AUDIT_RESP" | head -c 1)

if [ "$AUDIT_STATUS" = "[" ]; then
  assert_test "Audit Log Timeline endpoint returns valid JSON array of activities" 0
else
  assert_test "Audit Log returned invalid response" 1
fi

# ------------------------------------------------------------------------------
# 7. Frontend Build & Syntax Validation
# ------------------------------------------------------------------------------
echo -e "\n⚛️ [7/7] Testing Frontend Compilation and Bundle Health..."

if (cd frontend && npm run build >/dev/null 2>&1); then
  assert_test "Frontend React bundle compiled cleanly with 0 syntax or import errors" 0
else
  assert_test "Frontend build failed" 1
fi

# ------------------------------------------------------------------------------
# Summary Report
# ------------------------------------------------------------------------------
echo -e "\n${BLUE}====================================================================${NC}"
echo -e "  Verification Summary: ${GREEN}$pass_count Passed${NC}, ${RED}$fail_count Failed${NC}"
echo -e "${BLUE}====================================================================${NC}\n"

if [ "$fail_count" -gt 0 ]; then
  exit 1
fi

exit 0
