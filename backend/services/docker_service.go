package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"ai-cloud-api/models"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/archive"
	"github.com/docker/docker/pkg/stdcopy"
)

// BuildImage packages the buildDir and builds a docker image
func BuildImage(ctx context.Context, buildDir string, logChan chan<- string, customImageName ...string) (string, error) {

	logChan <- "Packaging workspace for Docker engine...\n"
	tar, err := archive.TarWithOptions(buildDir, &archive.TarOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to package build directory: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", fmt.Errorf("failed to connect to Docker daemon: %w", err)
	}
	defer cli.Close()

	imageName := "my-app-" + filepath.Base(buildDir)
	if len(customImageName) > 0 && customImageName[0] != "" {
		imageName = customImageName[0]
	}
	logChan <- fmt.Sprintf("Building Docker image: %s\n", imageName)

	buildResponse, err := cli.ImageBuild(ctx, tar, types.ImageBuildOptions{
		Tags:   []string{imageName},
		Remove: true,
	})
	if err != nil {
		return "", fmt.Errorf("failed to start Docker image build: %w", err)
	}
	defer buildResponse.Body.Close()

	// Parse JSON stream to catch build errors properly
	decoder := json.NewDecoder(buildResponse.Body)
	for {
		var msg map[string]interface{}
		if err := decoder.Decode(&msg); err != nil {
			if err == io.EOF {
				break
			}
			return "", fmt.Errorf("failed to parse build stream: %w", err)
		}

		// If error field exists, build failed
		if errMsg, ok := msg["error"]; ok {
			return "", fmt.Errorf("Docker build failed: %v", errMsg)
		}

		// Stream logs to console and log channel
		if streamMsg, ok := msg["stream"]; ok {
			str := fmt.Sprintf("%v", streamMsg)
			fmt.Print(str)
			logChan <- str
		}
	}

	logChan <- fmt.Sprintf("Successfully built Docker image: %s\n", imageName)
	return imageName, nil
}

// CreateAndStartContainer creates a container from the image and starts it, returning ID and public port
func CreateAndStartContainer(ctx context.Context, imageName string, envVars string, targetPort string) (string, string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", "", fmt.Errorf("failed to connect to Docker daemon: %w", err)
	}
	defer cli.Close()

	if targetPort == "" {
		targetPort = "80"
	}

	// 1. สร้างชื่อโดเมนเท่ๆ จากชื่อโปรเจกต์ เช่น my-app-deploy-1234.localhost
	domainName := imageName + ".localhost"

	var envList []string
	if envVars != "" {
		for _, line := range strings.Split(envVars, "\n") {
			line = strings.TrimSpace(line)
			if line != "" && strings.Contains(line, "=") {
				envList = append(envList, line)
			}
		}
	}

	// มั่นใจได้เสมอว่าจะมี PORT เข้าไปใน Container ป้องกันกรณีโค้ดเรียก process.env.PORT แล้วเป็นค่าว่างหรือ undefined
	hasValidPort := false
	for i, env := range envList {
		if strings.HasPrefix(env, "PORT=") {
			val := strings.TrimSpace(strings.TrimPrefix(env, "PORT="))
			if val == "" && targetPort != "" {
				envList[i] = "PORT=" + targetPort
			}
			hasValidPort = true
			break
		}
	}
	if !hasValidPort && targetPort != "" {
		envList = append(envList, "PORT="+targetPort)
	}

	// รองรับกรณี SERVER_PORT มีค่าว่างด้วย (เช่น docker-compose ใช้ SERVER_PORT)
	for i, env := range envList {
		if strings.HasPrefix(env, "SERVER_PORT=") {
			val := strings.TrimSpace(strings.TrimPrefix(env, "SERVER_PORT="))
			if val == "" && targetPort != "" {
				envList[i] = "SERVER_PORT=" + targetPort
			}
		}
	}

	// 2. แปะป้ายชื่อ (Labels) สั่งงาน Traefik
	networkConfig := &network.NetworkingConfig{
		EndpointsConfig: map[string]*network.EndpointSettings{
			"ai-cloud-network": {
				Aliases: []string{imageName},
			},
		},
	}

	resp, err := cli.ContainerCreate(ctx, &container.Config{
		Image: imageName,
		Env:   envList,
		Labels: map[string]string{
			"traefik.enable": "true", // บอก Traefik ว่าให้ช่วยจัดการตัวนี้หน่อย
			"traefik.http.routers." + imageName + ".rule": "Host(`" + domainName + "`)", // กำหนดชื่อโดเมน
			"traefik.http.services." + imageName + ".loadbalancer.server.port": targetPort, // พอร์ตภายในตาม Service จริง
		},
	}, &container.HostConfig{
		NetworkMode: "ai-cloud-network", // พระเอก! จับมันยัดเข้าเครือข่ายเดียวกับ Traefik
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped", // ถ้าดับเองเพราะ Crash หรือ Reboot ให้พยายามสตาร์ตกลับขึ้นมาใหม่อัตโนมัติ
		},
		Resources: container.Resources{
			Memory: 256 * 1024 * 1024,
		},
	}, networkConfig, nil, "")

	if err != nil {
		return "", "", fmt.Errorf("สร้าง Container ไม่สำเร็จ: %w", err)
	}

	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", "", fmt.Errorf("รัน Container ไม่สำเร็จ: %w", err)
	}

	// ไม่ต้องมานั่งหา Public Port แล้ว ส่งกลับเป็นชื่อ Domain เนมแทนเลย!
	return resp.ID, domainName, nil
}


func ListContainers(ctx context.Context) ([]models.ContainerDTO, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	containers, err := cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return nil, err
	}

	var list []models.ContainerDTO
	for _, con := range containers {
		var publicPort uint16 = 0
		if len(con.Ports) > 0 {
			publicPort = con.Ports[0].PublicPort
		}
		list = append(list, models.ContainerDTO{
			ID:         con.ID[:12],
			Name:       con.Names[0],
			Image:      con.Image,
			Status:     con.Status,
			State:      con.State,
			PublicPort: publicPort,
		})
	}
	return list, nil
}

func StopContainer(ctx context.Context, id string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()
	return cli.ContainerStop(ctx, id, container.StopOptions{})
}

func StartContainer(ctx context.Context, id string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()
	return cli.ContainerStart(ctx, id, container.StartOptions{})
}

func DeleteContainer(ctx context.Context, id string) error {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}
	defer cli.Close()

	inspect, err := cli.ContainerInspect(ctx, id)
	var imageID string
	if err == nil {
		imageID = inspect.Image
	}

	err = cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})
	if err != nil {
		return err
	}

	if imageID != "" {
		cli.ImageRemove(ctx, imageID, image.RemoveOptions{Force: true, PruneChildren: true})
	}
	return nil
}

// GetContainerEnv ดึง Environment Variables ที่คอนเทนเนอร์นี้ใช้อยู่ (กรองค่า System พื้นฐานของ OS ออก)
func GetContainerEnv(ctx context.Context, id string) ([]string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	inspect, err := cli.ContainerInspect(ctx, id)
	if err != nil {
		return nil, err
	}

	// กรองตัวแปรระบบของ Docker / Linux Base Image ออก เช่น PATH, HOSTNAME เพื่อไม่ให้ไปกวนผู้ใช้
	var userEnvs []string
	systemPrefixes := []string{"PATH=", "HOSTNAME=", "NODE_VERSION=", "YARN_VERSION=", "GOLANG_VERSION=", "GOPATH=", "HOME="}
	for _, env := range inspect.Config.Env {
		isSystem := false
		for _, prefix := range systemPrefixes {
			if strings.HasPrefix(env, prefix) {
				isSystem = true
				break
			}
		}
		if !isSystem {
			userEnvs = append(userEnvs, env)
		}
	}

	return userEnvs, nil
}

// UpdateContainerEnv สร้างคอนเทนเนอร์ใหม่พร้อมใส่ Env ใหม่ โดยไม่ต้อง Build โค้ดใหม่
func UpdateContainerEnv(ctx context.Context, oldID string, newEnvVars string) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	inspect, err := cli.ContainerInspect(ctx, oldID)
	if err != nil {
		return "", fmt.Errorf("ไม่พบคอนเทนเนอร์เดิม: %w", err)
	}

	imageName := inspect.Config.Image
	labels := inspect.Config.Labels
	targetPort := "80"
	for k, v := range labels {
		if strings.HasSuffix(k, "loadbalancer.server.port") {
			targetPort = v
			break
		}
	}

	// ลบคอนเทนเนอร์เดิมทิ้ง
	_ = cli.ContainerStop(ctx, oldID, container.StopOptions{})
	_ = cli.ContainerRemove(ctx, oldID, container.RemoveOptions{Force: true})

	// รันตัวใหม่ขึ้นมาแทนทันทีด้วย Image เดิม แต่ใส่ Env ใหม่
	newID, _, err := CreateAndStartContainer(ctx, imageName, newEnvVars, targetPort)
	if err != nil {
		return "", fmt.Errorf("เริ่มคอนเทนเนอร์ใหม่ไม่สำเร็จ: %w", err)
	}

	// ถ้ามีการผูก DATABASE_URL ให้ sync Prisma schema ลงฐานข้อมูลให้อัตโนมัติ (เช่น npx prisma db push)
	if strings.Contains(newEnvVars, "DATABASE_URL=") {
		AutoSyncPrismaSchema(newID)
	}

	return newID, nil
}

// AutoSyncPrismaSchema ตรวจสอบและ sync database schema อัตโนมัติในเบื้องหลัง
func AutoSyncPrismaSchema(containerID string) {
	go func() {
		time.Sleep(2 * time.Second)
		cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
		if err != nil {
			return
		}
		defer cli.Close()

		execConfig := types.ExecConfig{
			Cmd:          []string{"sh", "-c", "npx prisma db push --skip-generate || true; node prisma/seed.js || npx prisma db seed || true"},
			AttachStdout: false,
			AttachStderr: false,
		}
		execResp, err := cli.ContainerExecCreate(context.Background(), containerID, execConfig)
		if err == nil {
			_ = cli.ContainerExecStart(context.Background(), execResp.ID, types.ExecStartCheck{})
		}
	}()
}

func GetContainerLogs(ctx context.Context, containerID string) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	logReader, err := cli.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       "150",
	})
	if err != nil {
		return "", err
	}
	defer logReader.Close()

	var stdoutBuf, stderrBuf bytes.Buffer
	_, err = stdcopy.StdCopy(&stdoutBuf, &stderrBuf, logReader)
	if err != nil {
		// Fallback for tty containers or non-multiplexed logs
		rawLogs, _ := io.ReadAll(logReader)
		return string(rawLogs), nil
	}

	result := stdoutBuf.String()
	if stderrBuf.Len() > 0 {
		if result != "" {
			result += "\n"
		}
		result += stderrBuf.String()
	}
	return result, nil
}

type ContainerStatsData struct {
	MemoryStats struct {
		Usage float64 `json:"usage"`
		Limit float64 `json:"limit"`
	} `json:"memory_stats"`
	CPUStats struct {
		CPUUsage struct {
			TotalUsage float64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage float64 `json:"system_cpu_usage"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage struct {
			TotalUsage float64 `json:"total_usage"`
		} `json:"cpu_usage"`
		SystemCPUUsage float64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
}

func GetContainerStats( ctx context.Context, containerID string) (map[string]interface{}, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	stats, err := cli.ContainerStats(ctx, containerID, false)

	if	err != nil {
		return nil, err
	}

	defer stats.Body.Close()

	// ถอดรหัสข้อมูลที่ได้มา ใส่ลงใน Struct
	var data ContainerStatsData
	if err := json.NewDecoder(stats.Body).Decode(&data); err != nil {
		return nil, err
	}

	//สูตรคำนวณ Memory (แปลงเป็น Megabyte)
	memUsageMB := data.MemoryStats.Usage / 1024 / 1024
	memLimitMB := data.MemoryStats.Limit / 1024 / 1024

	
	cpuDelta := data.CPUStats.CPUUsage.TotalUsage - data.PreCPUStats.CPUUsage.TotalUsage
	systemDelta := data.CPUStats.SystemCPUUsage - data.PreCPUStats.SystemCPUUsage
	cpuPercent := 0.0
	if systemDelta > 0.0 && cpuDelta > 0.0 {
		cpuPercent = (cpuDelta / systemDelta) * 100.0
	}

	// แพ็กข้อมูลส่งกลับไป
	return map[string]interface{}{
		"cpu_percent":    cpuPercent,
		"memory_mb":      memUsageMB,
		"memory_limit":   memLimitMB,
	}, nil
}

func RedeployApp(ctx context.Context, id string, rawRepoURL string, imageName string, forceAI bool, gitToken ...string) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	inspect, err := cli.ContainerInspect(ctx, id)
	var oldEnvVars string
	if err == nil && len(inspect.Config.Env) > 0 {
		oldEnvVars = strings.Join(inspect.Config.Env, "\n")
	}

	cleanRepoURL := rawRepoURL
	isBackend := strings.HasSuffix(rawRepoURL, " (Backend)")
	isFrontend := strings.HasSuffix(rawRepoURL, " (Frontend)")
	cleanRepoURL = strings.TrimSpace(strings.TrimSuffix(strings.TrimSuffix(cleanRepoURL, " (Backend)"), " (Frontend)"))

	token := ""
	if len(gitToken) > 0 {
		token = gitToken[0]
	}

	buildDir, err := CloneRepository(cleanRepoURL, token)
	if err != nil {
		return "", fmt.Errorf("โหลดโค้ดใหม่ไม่สำเร็จ: %w", err)
	}
	defer os.RemoveAll(buildDir)

	targetPort := "80"
	isMonorepo, feDir, beDir := DetectMonorepoServices(ctx, buildDir)
	activeDir := buildDir
	if isMonorepo {
		if isBackend {
			activeDir = filepath.Join(buildDir, beDir)
			aiDocker, port, err := GenerateDockerfile(ctx, cleanRepoURL, activeDir, beDir)
			if err != nil {
				return "", fmt.Errorf("AI สร้าง Dockerfile Backend ไม่สำเร็จ: %w", err)
			}
			targetPort = port
			os.WriteFile(filepath.Join(activeDir, "Dockerfile"), []byte(aiDocker), 0644)
		} else if isFrontend {
			activeDir = filepath.Join(buildDir, feDir)
			backendName := strings.TrimSuffix(imageName, "-frontend") + "-backend"
			backendEndpoint := fmt.Sprintf("%s:8080", backendName)
			aiDocker, port, err := GenerateDockerfile(ctx, cleanRepoURL, activeDir, feDir, backendEndpoint)
			if err != nil {
				return "", fmt.Errorf("AI สร้าง Dockerfile Frontend ไม่สำเร็จ: %w", err)
			}
			targetPort = port
			os.WriteFile(filepath.Join(activeDir, "Dockerfile"), []byte(aiDocker), 0644)

			backendInternalURL := fmt.Sprintf("http://%s", backendEndpoint)
			feApiKeys := DetectFrontendAPIEnvKeys(activeDir)
			for _, k := range feApiKeys {
				if !strings.Contains(oldEnvVars, k+"=") {
					if oldEnvVars != "" {
						oldEnvVars += "\n"
					}
					oldEnvVars += fmt.Sprintf("%s=%s", k, backendInternalURL)
				}
			}
			if !strings.Contains(oldEnvVars, "BACKEND_URL=") {
				if oldEnvVars != "" {
					oldEnvVars += "\n"
				}
				oldEnvVars += fmt.Sprintf("BACKEND_URL=%s\nINTERNAL_API_URL=%s", backendInternalURL, backendInternalURL)
			}

			nginxConf := fmt.Sprintf(`server {
    listen 80;
    server_name localhost;
    resolver 127.0.0.11 valid=30s;
    set $backend_upstream "http://%s";

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass $backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`, backendEndpoint)
			os.WriteFile(filepath.Join(activeDir, "nginx.conf"), []byte(nginxConf), 0644)
		}
	} else {
		dockerfilePath := filepath.Join(buildDir, "Dockerfile")
		if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) || forceAI {
			aiDocker, port, err := GenerateDockerfile(ctx, cleanRepoURL, buildDir, "")
			if err != nil {
				return "", fmt.Errorf("สร้าง Dockerfile ไม่สำเร็จ: %w", err)
			}
			targetPort = port
			os.WriteFile(dockerfilePath, []byte(aiDocker), 0644)
		}
	}

	logChan := make(chan string)
	go func() {
		for msg := range logChan {
			fmt.Print(msg)
		}
	}()
	_, err = BuildImage(ctx, activeDir, logChan, imageName)
	if err != nil {
		return "", fmt.Errorf("สร้าง Image ใหม่ไม่สำเร็จ: %w", err)
	}

	newID, _, err := CreateAndStartContainer(ctx, imageName, oldEnvVars, targetPort)
	if err != nil {
		return "", fmt.Errorf("เปิดเซิร์ฟเวอร์ใหม่ไม่สำเร็จ: %w", err)
	}

	cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})

	// ล้างขยะ Image เก่าที่ไม่ได้ใช้งานเบื้องหลังอัตโนมัติ
	go PruneUnusedImages(context.Background())

	return newID, nil
}

// PruneUnusedImages สั่งลบ Dangling Docker Images ที่ไม่ได้ใช้งาน คืนพื้นที่ Disk Space
func PruneUnusedImages(ctx context.Context) (uint64, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return 0, err
	}
	defer cli.Close()

	report, err := cli.ImagesPrune(ctx, filters.NewArgs(filters.Arg("dangling", "true")))
	if err != nil {
		return 0, err
	}

	return report.SpaceReclaimed, nil
}
