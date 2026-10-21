package services

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
	"github.com/docker/go-connections/nat"
)

const (
	MaxDatabases = 5
	DBMemoryCap  = 512 * 1024 * 1024 // 512 MB
	DBCPULimit   = 1000000000        // 1 Core
)

// GenerateRandomSecret generates a secure random alphanumeric secret string.
func GenerateRandomSecret(length int) string {
	b := make([]byte, length)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)[:length]
}

// FindAvailablePort finds an unused host port checking database records, Docker containers, and host sockets.
func FindAvailablePort(startPort int) (int, error) {
	usedPorts := make(map[int]bool)

	// 1. Fetch ports assigned to managed databases in database
	if config.DB != nil {
		var activeDBs []models.ManagedDatabase
		config.DB.Where("status != ?", "deleted").Find(&activeDBs)
		for _, db := range activeDBs {
			if db.HostPort > 0 {
				usedPorts[db.HostPort] = true
			}
		}
	}

	// 2. Query ports occupied by any running Docker container
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()
		containers, err := cli.ContainerList(context.Background(), container.ListOptions{All: true})
		if err == nil {
			for _, c := range containers {
				for _, p := range c.Ports {
					if p.PublicPort > 0 {
						usedPorts[int(p.PublicPort)] = true
					}
				}
			}
		}
	}

	// 3. Find the first open host port bound to 0.0.0.0
	for port := startPort; port < startPort+500; port++ {
		if usedPorts[port] {
			continue
		}

		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err != nil {
			continue
		}
		_ = ln.Close()

		ln2, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", port))
		if err != nil {
			continue
		}
		_ = ln2.Close()

		return port, nil
	}
	return 0, fmt.Errorf("no available host port found")
}

// EnsureNetworkExists verifies and creates docker network if missing
func EnsureNetworkExists(ctx context.Context, cli *client.Client, networkName string) {
	networks, err := cli.NetworkList(ctx, types.NetworkListOptions{})
	if err != nil {
		return
	}
	for _, n := range networks {
		if n.Name == networkName {
			return
		}
	}
	_, _ = cli.NetworkCreate(ctx, networkName, types.NetworkCreate{})
}

// CreateManagedDatabase provisions a new database container (e.g. PostgreSQL)
func CreateManagedDatabase(ctx context.Context, req models.CreateDatabaseRequest) (*models.ManagedDatabase, error) {
	// 1. Check max database quota
	var activeCount int64
	config.DB.Model(&models.ManagedDatabase{}).Where("status != ?", "deleted").Count(&activeCount)
	if activeCount >= MaxDatabases {
		return nil, fmt.Errorf("database quota limit reached (%d databases) to preserve system memory", MaxDatabases)
	}

	// 2. Sanitize database name for Docker
	cleanName := strings.ToLower(strings.TrimSpace(req.Name))
	reg := regexp.MustCompile("[^a-z0-9_-]+")
	cleanName = reg.ReplaceAllString(cleanName, "-")
	cleanName = strings.Trim(cleanName, "-")
	if cleanName == "" {
		cleanName = "db-" + GenerateRandomSecret(6)
	}

	dbType := strings.ToLower(strings.TrimSpace(req.Type))
	if dbType == "" {
		dbType = "postgres"
	}

	// 3. Connect to Docker
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Docker: %w", err)
	}
	defer cli.Close()

	// 4. Ensure network
	networkName := "ai-cloud-network"
	EnsureNetworkExists(ctx, cli, networkName)

	timestamp := time.Now().Unix()
	containerName := fmt.Sprintf("cloud-db-%s-%d", cleanName, timestamp%10000)
	volumeName := fmt.Sprintf("cloud-db-vol-%s-%d", cleanName, timestamp%10000)
	password := GenerateRandomSecret(16)
	username := "postgres"
	dbName := cleanName

	var imageName string
	var internalPort int
	var env []string
	var portNat nat.Port

	switch dbType {
	case "postgres":
		imageName = "postgres:16-alpine"
		internalPort = 5432
		portNat = "5432/tcp"
		env = []string{
			fmt.Sprintf("POSTGRES_USER=%s", username),
			fmt.Sprintf("POSTGRES_PASSWORD=%s", password),
			fmt.Sprintf("POSTGRES_DB=%s", dbName),
		}
	default:
		return nil, fmt.Errorf("database type '%s' is not supported currently", dbType)
	}

	// 5. Pull image if needed
	reader, err := cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err == nil {
		_, _ = io.Copy(io.Discard, reader)
		_ = reader.Close()
	}

	// 6. Create persistent volume
	_, err = cli.VolumeCreate(ctx, volume.CreateOptions{Name: volumeName})
	if err != nil {
		return nil, fmt.Errorf("failed to create data volume: %w", err)
	}

	// 7. Find host port
	hostPort, err := FindAvailablePort(5433)
	if err != nil {
		return nil, err
	}

	wsID := strings.TrimSpace(req.WorkspaceID)
	if wsID == "" {
		wsID = "personal"
	}

	// 8. Create container with resource limits (RAM 512MB, 1 CPU)
	containerConfig := &container.Config{
		Image: imageName,
		Env:   env,
		ExposedPorts: nat.PortSet{
			portNat: struct{}{},
		},
		Labels: map[string]string{
			"ach.workspace": wsID,
			"ach.type":      "database",
		},
	}

	hostConfig := &container.HostConfig{
		PortBindings: nat.PortMap{
			portNat: []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: fmt.Sprintf("%d", hostPort),
				},
			},
		},
		Binds: []string{
			fmt.Sprintf("%s:/var/lib/postgresql/data", volumeName),
		},
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
		Resources: container.Resources{
			Memory:   DBMemoryCap,
			NanoCPUs: DBCPULimit,
		},
	}

	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			networkName: {},
		},
	}

	resp, err := cli.ContainerCreate(ctx, containerConfig, hostConfig, networkConfig, nil, containerName)
	if err != nil {
		return nil, fmt.Errorf("failed to create database container: %w", err)
	}

	// 9. Start Container
	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true})
		return nil, fmt.Errorf("failed to start database container: %w", err)
	}

	internalURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s", username, password, containerName, internalPort, dbName)
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = os.Getenv("PUBLIC_HOST")
	}
	if dbHost == "" {
		dbHost = os.Getenv("HOST_IP")
	}
	if dbHost == "" {
		dbHost = "localhost"
	}
	externalURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s", username, password, dbHost, hostPort, dbName)

	dbRecord := models.ManagedDatabase{
		WorkspaceID:   wsID,
		Name:          cleanName,
		Type:          dbType,
		Version:       "16-alpine",
		ContainerID:   resp.ID[:12],
		ContainerName: containerName,
		InternalPort:  internalPort,
		HostPort:      hostPort,
		Username:      username,
		Password:      password,
		DBName:        dbName,
		InternalURL:   internalURL,
		ExternalURL:   externalURL,
		Status:        "running",
		VolumeName:    volumeName,
		MemoryLimitMB: 512,
		StorageUsage:  "~28 MB",
	}

	if err := config.DB.Create(&dbRecord).Error; err != nil {
		return nil, fmt.Errorf("failed to save database record: %w", err)
	}

	utils.CreateNotification(wsID, "Database Provisioned", fmt.Sprintf("Dedicated PostgreSQL '%s' is ready on host port %d", cleanName, hostPort), "info", cleanName)

	return &dbRecord, nil
}

// GetDatabaseStorageUsage calculates disk storage consumed by the database container data directory.
func GetDatabaseStorageUsage(ctx context.Context, cli *client.Client, containerID string) string {
	if containerID == "" || cli == nil {
		return "~28 MB"
	}
	execConfig := types.ExecConfig{
		Cmd:          []string{"du", "-sh", "/var/lib/postgresql/data"},
		AttachStdout: true,
		AttachStderr: true,
	}
	execID, err := cli.ContainerExecCreate(ctx, containerID, execConfig)
	if err != nil {
		return "~32 MB"
	}
	resp, err := cli.ContainerExecAttach(ctx, execID.ID, types.ExecStartCheck{})
	if err != nil {
		return "~32 MB"
	}
	defer resp.Close()

	var outBuf bytes.Buffer
	_, _ = stdcopy.StdCopy(&outBuf, io.Discard, resp.Reader)
	output := strings.TrimSpace(outBuf.String())
	parts := strings.Fields(output)
	if len(parts) > 0 && parts[0] != "" {
		size := parts[0]
		if !strings.HasSuffix(size, "B") {
			size += "B"
		}
		return size
	}
	return "~32 MB"
}

// ListManagedDatabases retrieves all databases with live status, optionally filtered by workspace.
func ListManagedDatabases(ctx context.Context, workspaceID ...string) ([]models.ManagedDatabase, error) {
	var databases []models.ManagedDatabase
	query := config.DB.Where("status != ?", "deleted")
	if len(workspaceID) > 0 && workspaceID[0] != "" {
		query = query.Where("workspace_id = ?", workspaceID[0])
	}
	query.Order("created_at desc").Find(&databases)

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return databases, nil
	}
	defer cli.Close()

	dockerContainers, _ := cli.ContainerList(ctx, container.ListOptions{All: true})
	stateMap := make(map[string]string)
	for _, c := range dockerContainers {
		stateMap[c.ID[:12]] = c.State
	}

	for i := range databases {
		if state, exists := stateMap[databases[i].ContainerID]; exists {
			if databases[i].Status != state {
				databases[i].Status = state
				config.DB.Model(&databases[i]).Update("status", state)
			}
			// Compute live storage utilization when container is running
			if state == "running" {
				realUsage := GetDatabaseStorageUsage(ctx, cli, databases[i].ContainerID)
				if realUsage != "" && realUsage != databases[i].StorageUsage {
					databases[i].StorageUsage = realUsage
					config.DB.Model(&databases[i]).Update("storage_usage", realUsage)
				}
			}
		} else if databases[i].Status != "deleted" {
			databases[i].Status = "exited"
			config.DB.Model(&databases[i]).Update("status", "exited")
		}
	}

	return databases, nil
}

// StopManagedDatabase stops the database container temporarily
func StopManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("database not found: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	timeout := 10
	_ = cli.ContainerStop(ctx, db.ContainerID, container.StopOptions{Timeout: &timeout})
	config.DB.Model(&db).Update("status", "exited")
	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Stopped", fmt.Sprintf("Database '%s' was stopped", db.Name), "warning", db.Name)
	return nil
}

// StartManagedDatabase resumes database container
func StartManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("database not found: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	if err := cli.ContainerStart(ctx, db.ContainerID, container.StartOptions{}); err != nil {
		return fmt.Errorf("failed to start database: %w", err)
	}
	config.DB.Model(&db).Update("status", "running")
	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Resumed", fmt.Sprintf("Database '%s' is back online", db.Name), "info", db.Name)
	return nil
}

// DeleteManagedDatabase removes database container and volume
func DeleteManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("database not found: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()
		_ = cli.ContainerRemove(ctx, db.ContainerID, container.RemoveOptions{Force: true})
		if db.VolumeName != "" {
			_ = cli.VolumeRemove(ctx, db.VolumeName, true)
		}
	}

	config.DB.Model(&db).Update("status", "deleted")
	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Deleted", fmt.Sprintf("Database '%s' was removed along with its persistent volume", db.Name), "warning", db.Name)
	return nil
}

// ExecSQLInDatabase executes SQL query in PostgreSQL container via psql
func ExecSQLInDatabase(ctx context.Context, id uint, sqlQuery string) (string, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return "", fmt.Errorf("database not found: %w", err)
	}

	if db.Status != "running" {
		return "", fmt.Errorf("database is stopped. Please start the database before running queries")
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	execConfig := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd: []string{
			"psql",
			"-U", db.Username,
			"-d", db.DBName,
			"-c", sqlQuery,
		},
	}

	execResp, err := cli.ContainerExecCreate(ctx, db.ContainerID, execConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create exec process: %w", err)
	}

	attachResp, err := cli.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{Tty: true})
	if err != nil {
		return "", fmt.Errorf("failed to attach exec process: %w", err)
	}
	defer attachResp.Close()

	outputBytes, err := io.ReadAll(attachResp.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to read query output: %w", err)
	}

	outputStr := string(outputBytes)
	outputStr = strings.ReplaceAll(outputStr, "\r", "")
	return strings.TrimSpace(outputStr), nil
}

// ListDatabaseTables retrieves all table names in the database
func ListDatabaseTables(ctx context.Context, id uint) ([]string, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return nil, fmt.Errorf("database not found: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	// Use -t -A flags to return clean table names line-by-line without table borders or headers
	execConfig := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Tty:          true,
		Cmd: []string{
			"psql",
			"-U", db.Username,
			"-d", db.DBName,
			"-t", "-A",
			"-c", "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;",
		},
	}

	execResp, err := cli.ContainerExecCreate(ctx, db.ContainerID, execConfig)
	if err != nil {
		return nil, err
	}

	attachResp, err := cli.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{Tty: true})
	if err != nil {
		return nil, err
	}
	defer attachResp.Close()

	outputBytes, err := io.ReadAll(attachResp.Reader)
	if err != nil {
		return nil, err
	}

	rawOutput := strings.ReplaceAll(string(outputBytes), "\r", "")
	lines := strings.Split(rawOutput, "\n")
	var tables []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			tables = append(tables, line)
		}
	}
	return tables, nil
}

// BindDatabaseToContainer binds a database to an active container and restarts it
func BindDatabaseToContainer(ctx context.Context, dbID uint, targetContainerID string) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, dbID).Error; err != nil {
		return fmt.Errorf("database not found: %w", err)
	}

	currentEnvs, err := GetContainerEnv(ctx, targetContainerID)
	if err != nil {
		return fmt.Errorf("failed to retrieve target container environment: %w", err)
	}

	dbAliases := []string{
		fmt.Sprintf("DATABASE_URL=%s", db.InternalURL),
		fmt.Sprintf("DB_URL=%s", db.InternalURL),
		fmt.Sprintf("POSTGRES_URL=%s", db.InternalURL),
		fmt.Sprintf("DB_HOST=%s", db.ContainerName),
		"DB_PORT=5432",
		fmt.Sprintf("DB_USER=%s", db.Username),
		fmt.Sprintf("DB_PASSWORD=%s", db.Password),
		fmt.Sprintf("DB_NAME=%s", db.DBName),
	}

	dbPrefixes := []string{"DATABASE_URL=", "DB_URL=", "POSTGRES_URL=", "DB_HOST=", "DB_PORT=", "DB_USER=", "DB_PASSWORD=", "DB_NAME="}
	var newEnvs []string
	for _, env := range currentEnvs {
		hasPrefix := false
		for _, prefix := range dbPrefixes {
			if strings.HasPrefix(env, prefix) {
				hasPrefix = true
				break
			}
		}
		if !hasPrefix {
			newEnvs = append(newEnvs, env)
		}
	}
	newEnvs = append(newEnvs, dbAliases...)

	newID, err := UpdateContainerEnv(ctx, targetContainerID, strings.Join(newEnvs, "\n"))
	if err != nil {
		return fmt.Errorf("failed to update and restart container: %w", err)
	}

	var deploy models.Deployment
	if err := config.DB.Where("container_id LIKE ?", targetContainerID[:8]+"%").First(&deploy).Error; err == nil {
		config.DB.Model(&deploy).Updates(map[string]interface{}{
			"container_id": newID[:12],
			"status":       "running",
			"last_error":   "",
		})
	}

	return nil
}

// AutoExecuteRepoSQL detects .sql files in the repo and executes them against the linked database.
func AutoExecuteRepoSQL(ctx context.Context, buildDir string, envVars string, logChan chan string) {
	if strings.TrimSpace(envVars) == "" {
		return
	}

	var runningDBs []models.ManagedDatabase
	config.DB.Where("status = ?", "running").Find(&runningDBs)
	if len(runningDBs) == 0 {
		return
	}

	var targetDB *models.ManagedDatabase
	for i, db := range runningDBs {
		if strings.Contains(envVars, db.ContainerName) || strings.Contains(envVars, db.InternalURL) || (db.DBName != "" && strings.Contains(envVars, db.DBName)) {
			targetDB = &runningDBs[i]
			break
		}
	}

	if targetDB == nil {
		return
	}

	targetNames := map[string]bool{
		"schema.sql": true, "init.sql": true, "database.sql": true,
		"tables.sql": true, "db.sql": true, "create_tables.sql": true,
	}

	var foundSQLPath string
	var sqlRelName string

	_ = filepath.Walk(buildDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		base := strings.ToLower(info.Name())
		if targetNames[base] {
			foundSQLPath = path
			rel, _ := filepath.Rel(buildDir, path)
			sqlRelName = rel
			return filepath.SkipAll
		}
		return nil
	})

	if foundSQLPath != "" {
		sqlBytes, err := os.ReadFile(foundSQLPath)
		if err == nil && len(strings.TrimSpace(string(sqlBytes))) > 0 {
			logChan <- fmt.Sprintf("\n⚡ SQL schema detected: '%s'\n", sqlRelName)
			logChan <- fmt.Sprintf("🔄 Executing SQL schema against database '%s'...\n", targetDB.Name)
			_, execErr := ExecSQLInDatabase(ctx, targetDB.ID, string(sqlBytes))
			if execErr != nil {
				logChan <- fmt.Sprintf("⚠️ SQL schema execution warning: %v\n", execErr)
			} else {
				logChan <- fmt.Sprintf("✅ SQL schema applied successfully to '%s'!\n\n", targetDB.Name)
			}
		}
	}
}

// BackupDatabaseSQL dumps database contents to an SQL string.
func BackupDatabaseSQL(ctx context.Context, db models.ManagedDatabase) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	// Execute pg_dump with --clean --if-exists flags
	cmd := []string{
		"pg_dump",
		"-U", db.Username,
		"-d", db.DBName,
		"--clean",
		"--if-exists",
	}

	execConfig := types.ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          cmd,
		Env:          []string{"PGPASSWORD=" + db.Password},
		Tty:          false,
	}

	execIDResp, err := cli.ContainerExecCreate(ctx, db.ContainerID, execConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create exec: %w", err)
	}

	resp, err := cli.ContainerExecAttach(ctx, execIDResp.ID, types.ExecStartCheck{})
	if err != nil {
		return "", fmt.Errorf("failed to attach exec: %w", err)
	}
	defer resp.Close()

	var stdoutBuf, stderrBuf bytes.Buffer
	_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, resp.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to read dump stream: %w", err)
	}

	if stderrBuf.Len() > 0 && stdoutBuf.Len() == 0 {
		return "", fmt.Errorf("pg_dump error: %s", stderrBuf.String())
	}

	return stdoutBuf.String(), nil
}

// RestoreDatabaseSQL restores a database backup from an SQL string into PostgreSQL via psql.
func RestoreDatabaseSQL(ctx context.Context, db models.ManagedDatabase, sqlContent string) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	execConfig := types.ExecConfig{
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
		Cmd: []string{
			"psql",
			"-U", db.Username,
			"-d", db.DBName,
		},
		Env: []string{"PGPASSWORD=" + db.Password},
	}

	execIDResp, err := cli.ContainerExecCreate(ctx, db.ContainerID, execConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create exec for restore: %w", err)
	}

	resp, err := cli.ContainerExecAttach(ctx, execIDResp.ID, types.ExecStartCheck{})
	if err != nil {
		return "", fmt.Errorf("failed to attach exec for restore: %w", err)
	}
	defer resp.Close()

	// Stream SQL content into psql stdin
	go func() {
		defer resp.CloseWrite()
		io.WriteString(resp.Conn, sqlContent)
	}()

	var stdoutBuf, stderrBuf bytes.Buffer
	_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, resp.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to read restore output: %w", err)
	}

	out := stdoutBuf.String()
	if stderrBuf.Len() > 0 {
		out += "\n" + stderrBuf.String()
	}
	return strings.TrimSpace(out), nil
}

// CreateDatabaseSnapshot takes a PostgreSQL snapshot and saves it to local disk
func CreateDatabaseSnapshot(ctx context.Context, dbID uint, notes string, wsID string) (*models.DatabaseSnapshot, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, dbID).Error; err != nil {
		return nil, fmt.Errorf("database not found (ID: %d)", dbID)
	}

	if db.Status != "running" {
		return nil, fmt.Errorf("database must be running to take a snapshot")
	}

	sqlDump, err := BackupDatabaseSQL(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("failed to dump database: %w", err)
	}

	// Snapshot storage directory: data/backups/db_{id}
	baseDir := filepath.Join("data", "backups", fmt.Sprintf("db_%d", dbID))
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create snapshot directory: %w", err)
	}

	timeTag := time.Now().Format("20060102-150405")
	cleanName := regexp.MustCompile(`[^a-zA-Z0-9-]`).ReplaceAllString(db.Name, "-")
	fileName := fmt.Sprintf("snapshot-%s-%s.sql", cleanName, timeTag)
	fullPath := filepath.Join(baseDir, fileName)

	if err := os.WriteFile(fullPath, []byte(sqlDump), 0644); err != nil {
		return nil, fmt.Errorf("failed to save snapshot file: %w", err)
	}

	sizeBytes := int64(len(sqlDump))
	formattedSize := formatSize(sizeBytes)

	if wsID == "" {
		wsID = db.WorkspaceID
		if wsID == "" {
			wsID = "personal"
		}
	}

	snapshot := models.DatabaseSnapshot{
		DatabaseID:    dbID,
		WorkspaceID:   wsID,
		FileName:      fileName,
		FilePath:      fullPath,
		SizeBytes:     sizeBytes,
		FormattedSize: formattedSize,
		Type:          "manual",
		Notes:         strings.TrimSpace(notes),
		CreatedAt:     time.Now(),
	}

	if err := config.DB.Create(&snapshot).Error; err != nil {
		return nil, fmt.Errorf("failed to save snapshot record: %w", err)
	}

	utils.CreateNotification(wsID, "Database Snapshot Created", fmt.Sprintf("Created snapshot '%s' (%s) for database '%s'", fileName, formattedSize, db.Name), "success", db.Name)

	return &snapshot, nil
}

// ListDatabaseSnapshots retrieves all snapshots for a database
func ListDatabaseSnapshots(ctx context.Context, dbID uint) ([]models.DatabaseSnapshot, error) {
	var snapshots []models.DatabaseSnapshot
	if err := config.DB.Where("database_id = ?", dbID).Order("created_at desc").Find(&snapshots).Error; err != nil {
		return nil, err
	}
	return snapshots, nil
}

// RestoreDatabaseSnapshot restores database state from a specified snapshot ID
func RestoreDatabaseSnapshot(ctx context.Context, dbID uint, snapshotID uint) (string, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, dbID).Error; err != nil {
		return "", fmt.Errorf("database not found")
	}

	if db.Status != "running" {
		return "", fmt.Errorf("database must be running to perform a restore")
	}

	var snapshot models.DatabaseSnapshot
	if err := config.DB.Where("id = ? AND database_id = ?", snapshotID, dbID).First(&snapshot).Error; err != nil {
		return "", fmt.Errorf("snapshot not found")
	}

	// Security: Prevent path traversal
	cleanPath := filepath.Clean(snapshot.FilePath)
	if !strings.HasPrefix(cleanPath, filepath.Join("data", "backups")) {
		return "", fmt.Errorf("security error: invalid snapshot file path")
	}

	contentBytes, err := os.ReadFile(cleanPath)
	if err != nil {
		return "", fmt.Errorf("failed to read snapshot file: %w", err)
	}

	output, err := RestoreDatabaseSQL(ctx, db, string(contentBytes))
	if err != nil {
		return "", fmt.Errorf("failed to restore database: %w", err)
	}

	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Restored", fmt.Sprintf("Database '%s' restored from snapshot '%s'", db.Name, snapshot.FileName), "warning", db.Name)

	return output, nil
}

// DeleteDatabaseSnapshot removes snapshot file and database record
func DeleteDatabaseSnapshot(ctx context.Context, dbID uint, snapshotID uint) error {
	var snapshot models.DatabaseSnapshot
	if err := config.DB.Where("id = ? AND database_id = ?", snapshotID, dbID).First(&snapshot).Error; err != nil {
		return fmt.Errorf("snapshot not found")
	}

	// Security check
	cleanPath := filepath.Clean(snapshot.FilePath)
	if strings.HasPrefix(cleanPath, filepath.Join("data", "backups")) {
		_ = os.Remove(cleanPath)
	}

	return config.DB.Delete(&snapshot).Error
}

// GetSnapshotFilePath exports file path and name for downloading
func GetSnapshotFilePath(dbID uint, snapshotID uint) (string, string, error) {
	var snapshot models.DatabaseSnapshot
	if err := config.DB.Where("id = ? AND database_id = ?", snapshotID, dbID).First(&snapshot).Error; err != nil {
		return "", "", fmt.Errorf("snapshot not found")
	}

	cleanPath := filepath.Clean(snapshot.FilePath)
	if !strings.HasPrefix(cleanPath, filepath.Join("data", "backups")) {
		return "", "", fmt.Errorf("security error: invalid path")
	}

	return cleanPath, snapshot.FileName, nil
}

func formatSize(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
