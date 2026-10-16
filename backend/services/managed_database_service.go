package services

import (
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

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
)

const (
	MaxDatabases = 5
	DBMemoryCap  = 512 * 1024 * 1024 // 512 MB
	DBCPULimit   = 1000000000        // 1 Core
)

// GenerateRandomSecret สุ่มรหัสผ่านปลอดภัย
func GenerateRandomSecret(length int) string {
	b := make([]byte, length)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)[:length]
}

// FindAvailablePort หาพอร์ต Host ที่ว่างอยู่
func FindAvailablePort(startPort int) (int, error) {
	for port := startPort; port < startPort+200; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			_ = ln.Close()
			return port, nil
		}
	}
	return 0, fmt.Errorf("ไม่พบพอร์ตที่ว่างสำหรับใช้งาน")
}

// EnsureNetworkExists ตรวจสอบและสร้าง network ถ้ายังไม่มี
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

// CreateManagedDatabase สร้าง Database Container ใหม่ (เช่น PostgreSQL)
func CreateManagedDatabase(ctx context.Context, req models.CreateDatabaseRequest) (*models.ManagedDatabase, error) {
	// 1. ตรวจสอบจำนวน Database สูงสุด
	var activeCount int64
	config.DB.Model(&models.ManagedDatabase{}).Where("status != ?", "deleted").Count(&activeCount)
	if activeCount >= MaxDatabases {
		return nil, fmt.Errorf("คุณสร้าง Database ครบโควตาขีดจำกัด (%d ตัว) แล้วเพื่อป้องกันแรมเครื่องเต็ม", MaxDatabases)
	}

	// 2. จัดการชื่อให้อยู่ในฟอร์แมตที่ Docker รองรับ (ตัวพิมพ์เล็ก, ขีดกลาง)
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

	// 3. เชื่อมต่อ Docker
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("เชื่อมต่อ Docker ไม่สำเร็จ: %w", err)
	}
	defer cli.Close()

	// 4. เตรียม Network
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
		return nil, fmt.Errorf("ประเภท Database '%s' ยังไม่รองรับในปัจจุบัน", dbType)
	}

	// 5. ดึง Image (ถ้ายังไม่มี)
	reader, err := cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err == nil {
		_, _ = io.Copy(io.Discard, reader)
		_ = reader.Close()
	}

	// 6. สร้าง Persistent Volume
	_, err = cli.VolumeCreate(ctx, volume.CreateOptions{Name: volumeName})
	if err != nil {
		return nil, fmt.Errorf("สร้าง Volume สำหรับเก็บข้อมูลไม่สำเร็จ: %w", err)
	}

	// 7. หาพอร์ตภายนอก (Host Port) สำหรับให้คนใช้ DBeaver หรือ TablePlus ต่อเข้ามาได้
	hostPort, err := FindAvailablePort(5433)
	if err != nil {
		return nil, err
	}

	// 8. สร้าง Container พร้อมจำกัด Resource (RAM 512MB, 1 CPU)
	containerConfig := &container.Config{
		Image: imageName,
		Env:   env,
		ExposedPorts: nat.PortSet{
			portNat: struct{}{},
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
		return nil, fmt.Errorf("สร้าง Database Container ไม่สำเร็จ: %w", err)
	}

	// 9. สตาร์ต Container
	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return nil, fmt.Errorf("เริ่มรัน Database Container ไม่สำเร็จ: %w", err)
	}

	internalURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s", username, password, containerName, internalPort, dbName)
	externalURL := fmt.Sprintf("postgres://%s:%s@localhost:%d/%s", username, password, hostPort, dbName)

	dbRecord := models.ManagedDatabase{
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
		StorageUsage:  "~35 MB",
	}

	if err := config.DB.Create(&dbRecord).Error; err != nil {
		return nil, fmt.Errorf("บันทึกข้อมูล Database ลงฐานข้อมูลไม่สำเร็จ: %w", err)
	}

	return &dbRecord, nil
}

// ListManagedDatabases ดึงรายการ Database พร้อมสถานะปัจจุบัน
func ListManagedDatabases(ctx context.Context) ([]models.ManagedDatabase, error) {
	var databases []models.ManagedDatabase
	config.DB.Where("status != ?", "deleted").Order("created_at desc").Find(&databases)

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
		} else if databases[i].Status != "deleted" {
			databases[i].Status = "exited"
			config.DB.Model(&databases[i]).Update("status", "exited")
		}
	}

	return databases, nil
}

// StopManagedDatabase สั่งหยุดชั่วคราว
func StopManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("ไม่พบ Database: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	timeout := 10
	_ = cli.ContainerStop(ctx, db.ContainerID, container.StopOptions{Timeout: &timeout})
	config.DB.Model(&db).Update("status", "exited")
	return nil
}

// StartManagedDatabase สั่งเริ่มทำงานใหม่
func StartManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("ไม่พบ Database: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	if err := cli.ContainerStart(ctx, db.ContainerID, container.StartOptions{}); err != nil {
		return fmt.Errorf("เริ่มรันไม่สำเร็จ: %w", err)
	}
	config.DB.Model(&db).Update("status", "running")
	return nil
}

// DeleteManagedDatabase ลบ Database Container และ Volume
func DeleteManagedDatabase(ctx context.Context, id uint) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return fmt.Errorf("ไม่พบ Database: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()
		// ลบ Container
		_ = cli.ContainerRemove(ctx, db.ContainerID, container.RemoveOptions{Force: true})
		// ลบ Volume เพื่อคืนพื้นที่ดิสก์
		if db.VolumeName != "" {
			_ = cli.VolumeRemove(ctx, db.VolumeName, true)
		}
	}

	config.DB.Model(&db).Update("status", "deleted")
	return nil
}

// ExecSQLInDatabase รันคำสั่ง SQL หรือ Script ใน PostgreSQL Container ผ่าน psql
func ExecSQLInDatabase(ctx context.Context, id uint, sqlQuery string) (string, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return "", fmt.Errorf("ไม่พบ Database: %w", err)
	}

	if db.Status != "running" {
		return "", fmt.Errorf("Database กำลังหยุดทำงาน กรุณากด Start ก่อนสั่งรัน SQL")
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	// เรียกใช้ psql ภายใน Container โดยตรง (ใช้ Tty: true เพื่อไม่ให้มี header ไบนารีของ Docker)
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
		return "", fmt.Errorf("สร้าง Exec ไม่สำเร็จ: %w", err)
	}

	attachResp, err := cli.ContainerExecAttach(ctx, execResp.ID, types.ExecStartCheck{Tty: true})
	if err != nil {
		return "", fmt.Errorf("Attach Exec ไม่สำเร็จ: %w", err)
	}
	defer attachResp.Close()

	outputBytes, err := io.ReadAll(attachResp.Reader)
	if err != nil {
		return "", fmt.Errorf("อ่านผลลัพธ์ไม่สำเร็จ: %w", err)
	}

	outputStr := string(outputBytes)
	outputStr = strings.ReplaceAll(outputStr, "\r", "")
	return strings.TrimSpace(outputStr), nil
}

// ListDatabaseTables ดึงรายชื่อ Table ทั้งหมดใน Database
func ListDatabaseTables(ctx context.Context, id uint) ([]string, error) {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		return nil, fmt.Errorf("ไม่พบ Database: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	// ใช้ -t -A เพื่อให้คืนค่าเฉพาะชื่อตารางบรรทัดละ 1 ชื่อ ไม่มีขอบตารางและไม่มี header
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

// BindDatabaseToContainer ผูก Database เข้ากับคอนเทนเนอร์เซิร์ฟเวอร์ที่รันอยู่แล้ว และสั่งรีสตาร์ตให้อัตโนมัติ
func BindDatabaseToContainer(ctx context.Context, dbID uint, targetContainerID string) error {
	var db models.ManagedDatabase
	if err := config.DB.First(&db, dbID).Error; err != nil {
		return fmt.Errorf("ไม่พบ Database: %w", err)
	}

	currentEnvs, err := GetContainerEnv(ctx, targetContainerID)
	if err != nil {
		return fmt.Errorf("ไม่สามารถอ่านตัวแปรของเซิร์ฟเวอร์เป้าหมาย: %w", err)
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
		return fmt.Errorf("อัปเดตและเริ่มคอนเทนเนอร์ใหม่ไม่สำเร็จ: %w", err)
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

// AutoExecuteRepoSQL ตรวจหาไฟล์ .sql ใน Repo แล้วรันเข้า Managed Database อัตโนมัติถ้ามีการผูกไว้
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
			logChan <- fmt.Sprintf("\n⚡ ตรวจพบไฟล์ SQL Schema: '%s'\n", sqlRelName)
			logChan <- fmt.Sprintf("🔄 กำลังรันคำสั่ง SQL สร้าง Table ลงใน Database '%s' อัตโนมัติ...\n", targetDB.Name)
			_, execErr := ExecSQLInDatabase(ctx, targetDB.ID, string(sqlBytes))
			if execErr != nil {
				logChan <- fmt.Sprintf("⚠️ การรัน SQL Schema: %v\n", execErr)
			} else {
				logChan <- fmt.Sprintf("✅ สร้างโครงสร้าง Tables ใน Database '%s' เรียบร้อยแล้ว!\n\n", targetDB.Name)
			}
		}
	}
}


