package services

import (
	"context"
	"math"
	"runtime"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type HostHealthDTO struct {
	OS            string  `json:"os"`
	Platform      string  `json:"platform"`
	KernelArch    string  `json:"kernel_arch"`
	UptimeSeconds uint64  `json:"uptime_seconds"`
	CPUModel      string  `json:"cpu_model"`
	CPUCores      int     `json:"cpu_cores"`
	CPUUsage      float64 `json:"cpu_usage"`

	MemTotalMB uint64  `json:"mem_total_mb"`
	MemUsedMB  uint64  `json:"mem_used_mb"`
	MemFreeMB  uint64  `json:"mem_free_mb"`
	MemUsage   float64 `json:"mem_usage"`

	DiskTotalGB uint64  `json:"disk_total_gb"`
	DiskUsedGB  uint64  `json:"disk_used_gb"`
	DiskFreeGB  uint64  `json:"disk_free_gb"`
	DiskUsage   float64 `json:"disk_usage"`

	DockerContainersRunning int    `json:"docker_containers_running"`
	DockerContainersTotal   int    `json:"docker_containers_total"`
	DockerImagesCount       int    `json:"docker_images_count"`
	DockerServerVersion     string `json:"docker_server_version"`
}

// GetHostHealth gathers real host OS metrics (CPU, RAM, Disk) and Docker daemon stats
func GetHostHealth(ctx context.Context) (*HostHealthDTO, error) {
	dto := &HostHealthDTO{
		OS:         runtime.GOOS,
		KernelArch: runtime.GOARCH,
		CPUCores:   runtime.NumCPU(),
	}

	// 1. Host Info
	if hInfo, err := host.InfoWithContext(ctx); err == nil {
		dto.Platform = hInfo.Platform
		if dto.Platform == "" {
			dto.Platform = hInfo.OS
		}
		dto.UptimeSeconds = hInfo.Uptime
	}

	// 2. CPU Usage
	cpuPercents, err := cpu.PercentWithContext(ctx, 200*time.Millisecond, false)
	if err == nil && len(cpuPercents) > 0 {
		dto.CPUUsage = math.Round(cpuPercents[0]*10) / 10
	}
	if cpuInfos, err := cpu.InfoWithContext(ctx); err == nil && len(cpuInfos) > 0 {
		dto.CPUModel = cpuInfos[0].ModelName
	}

	// 3. Memory Stats
	if vm, err := mem.VirtualMemoryWithContext(ctx); err == nil {
		dto.MemTotalMB = vm.Total / (1024 * 1024)
		dto.MemUsedMB = vm.Used / (1024 * 1024)
		dto.MemFreeMB = vm.Available / (1024 * 1024)
		dto.MemUsage = math.Round(vm.UsedPercent*10) / 10
	}

	// 4. Disk Stats
	diskRoot := "/"
	if runtime.GOOS == "windows" {
		diskRoot = "C:"
	}
	if dUsage, err := disk.UsageWithContext(ctx, diskRoot); err == nil {
		dto.DiskTotalGB = dUsage.Total / (1024 * 1024 * 1024)
		dto.DiskUsedGB = dUsage.Used / (1024 * 1024 * 1024)
		dto.DiskFreeGB = dUsage.Free / (1024 * 1024 * 1024)
		dto.DiskUsage = math.Round(dUsage.UsedPercent*10) / 10
	}

	// 5. Docker Engine Stats
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()

		if info, err := cli.Info(ctx); err == nil {
			dto.DockerContainersTotal = info.Containers
			dto.DockerContainersRunning = info.ContainersRunning
			dto.DockerImagesCount = info.Images
			dto.DockerServerVersion = info.ServerVersion
		}
	}

	return dto, nil
}

// PruneDockerSystem executes comprehensive cleaning of unused images, build caches, and stopped containers
func PruneDockerSystem(ctx context.Context) (map[string]interface{}, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	defer cli.Close()

	// 1. Prune unused images
	imgReport, _ := cli.ImagesPrune(ctx, filters.NewArgs())
	imagesDeleted := len(imgReport.ImagesDeleted)
	spaceReclaimed := imgReport.SpaceReclaimed

	// 2. Prune stopped containers
	cntReport, _ := cli.ContainersPrune(ctx, filters.NewArgs())
	containersDeleted := len(cntReport.ContainersDeleted)
	spaceReclaimed += cntReport.SpaceReclaimed

	// 3. Prune build cache
	buildReport, _ := cli.BuildCachePrune(ctx, types.BuildCachePruneOptions{})
	if buildReport != nil {
		spaceReclaimed += buildReport.SpaceReclaimed
	}

	spaceReclaimedMB := float64(spaceReclaimed) / (1024 * 1024)

	return map[string]interface{}{
		"images_deleted":     imagesDeleted,
		"containers_deleted": containersDeleted,
		"space_reclaimed_mb": math.Round(spaceReclaimedMB*10) / 10,
	}, nil
}
