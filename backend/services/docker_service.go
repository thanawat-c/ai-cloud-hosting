package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"ai-cloud-api/models"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/archive"
)

// BuildImage packages the buildDir and builds a docker image
func BuildImage(ctx context.Context, buildDir string, logChan chan<- string) (string, error) {

	logChan <- "กำลังแพ็กโฟลเดอร์เพื่อส่งให้ Docker...\n"
	tar, err := archive.TarWithOptions(buildDir, &archive.TarOptions{})
	if err != nil {
		return "", fmt.Errorf("แพ็กไฟล์ไม่สำเร็จ: %w", err)
	}

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", fmt.Errorf("เชื่อมต่อ Docker ไม่สำเร็จ: %w", err)
	}
	defer cli.Close()

	imageName := "my-app-" + filepath.Base(buildDir)
	logChan <- fmt.Sprintf("กำลัง Build Image ชื่อ: %s\n", imageName)

	buildResponse, err := cli.ImageBuild(ctx, tar, types.ImageBuildOptions{
		Tags:   []string{imageName},
		Remove: true,
	})
	if err != nil {
		return "", fmt.Errorf("Build Image ไม่สำเร็จ: %w", err)
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
			return "", fmt.Errorf("อ่านผลลัพธ์การ Build ไม่สำเร็จ: %w", err)
		}

		// ถ้าเจอกุญแจคำว่า "error" ใน Stream แปลว่า Build พัง!
		if errMsg, ok := msg["error"]; ok {
			return "", fmt.Errorf("Docker Build ล้มเหลว: %v", errMsg)
		}

		// พิมพ์ Log การ Build ออกทาง Terminal ปกติ
		if streamMsg, ok := msg["stream"]; ok {
			str := fmt.Sprintf("%v", streamMsg)
			fmt.Print(str) // พิมพ์ลงจอเรา
			logChan <- str // ดันเข้าท่อส่งไปให้ลูกค้า!
		}
	}

	logChan <- fmt.Sprintf("Build Image เสร็จสมบูรณ์! ได้ Image ชื่อ: %s\n", imageName)
	return imageName, nil
}

// CreateAndStartContainer creates a container from the image and starts it, returning ID and public port
func CreateAndStartContainer(ctx context.Context, imageName string, envVars string, targetPort string) (string, string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", "", fmt.Errorf("เชื่อมต่อ Docker ไม่สำเร็จ: %w", err)
	}
	defer cli.Close()

	if targetPort == "" {
		targetPort = "80"
	}

	// 1. สร้างชื่อโดเมนเท่ๆ จากชื่อโปรเจกต์ เช่น my-app-deploy-1234.localhost
	domainName := imageName + ".localhost"

	var envList []string
	if envVars != "" {
		envList = strings.Split(envVars, "\n")
	}

	// 2. แปะป้ายชื่อ (Labels) สั่งงาน Traefik
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
		// PublishAllPorts: true, (ลบทิ้งได้เลย เราไม่ต้องสุ่มพอร์ตมั่วๆ ออกมาข้างนอกอีกแล้ว ปลอดภัยขึ้นเยอะ!)
		Resources: container.Resources{
			Memory: 256 * 1024 * 1024,
		},
	}, nil, nil, "")

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

func GetContainerLogs(ctx context.Context, containerID string) (string, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", err
	}
	defer cli.Close()

	logReader, err := cli.ContainerLogs(ctx, containerID, container.LogsOptions{ShowStdout: true, ShowStderr: true})

	if err != nil {
		return "", err
	}

	defer logReader.Close()

	logs, err := io.ReadAll(logReader)
	if err != nil {
		return "", err
	}

	return string(logs), nil
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

func RedeployApp(ctx context.Context, id string, repoURL string, imageName string, forceAI bool) (string, error) {

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

	buildDir, err := CloneRepository(repoURL)

	if	err != nil {
		return "", fmt.Errorf("โหลดโค้ดใหม่ไม่สำเร็จ: %w", err)
	}

	defer os.RemoveAll(buildDir)

	dockerfilePath := filepath.Join(buildDir, "Dockerfile")
	targetPort := "80"
	if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) || forceAI {
		if forceAI {
			fmt.Println("✨ เปิดโหมด Force AI Override: กำลังให้ AI เขียน Dockerfile ทับของเดิม...")
		}
		aiDocker, port, _ := GenerateDockerfile(ctx, repoURL, buildDir, "")
		targetPort = port
		os.WriteFile(dockerfilePath, []byte(aiDocker), 0644)
	}

	logChan := make(chan string)
	go func() {
		for msg := range logChan {
			fmt.Print(msg)
		}
	}()
	_, err = BuildImage(ctx, buildDir, logChan)
	if err != nil {
		return "", fmt.Errorf("สร้าง Image ใหม่ไม่สำเร็จ: %w", err)
	}

	newID, _, err := CreateAndStartContainer(ctx, imageName, oldEnvVars, targetPort)
	if err != nil {
		return "", fmt.Errorf("เปิดเซิฟร์เวอร์ใหม่ไม่สำเร็จ: %w", err)
	}

	cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true})

	return newID,nil
}
