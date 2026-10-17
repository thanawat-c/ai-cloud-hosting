package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
)

func GetContainers(c *gin.Context) {
	// ล้างประวัติ Deployment ผีที่ไม่มี Container จริงๆ (เช่น พิมพ์ URL มั่วแล้ว Clone ไม่ผ่าน)
	config.DB.Where("container_id = '' OR container_id IS NULL").Delete(&models.Deployment{})

	// 1. ดึงประวัติทั้งหมดจาก Database (เฉพาะที่มี ContainerID จริง และไม่รวมที่ลบทิ้งไปแล้ว)
	var deployments []models.Deployment
	config.DB.Where("status != ? AND container_id != ''", "deleted").Order("created_at desc").Find(&deployments)

	// 2. ดึงสถานะปัจจุบันของ Container ที่รันอยู่ใน Docker จริงๆ ทั้งหมด
	dockerContainers, _ := services.ListContainers(context.Background())
	
	// ดึงรายการ Managed Database ทั้งหมดเพื่อนำมาตรวจจับสถานะการเชื่อมต่อ DB
	var allDBs []models.ManagedDatabase
	config.DB.Where("status != ?", "deleted").Find(&allDBs)

	// สร้างสมุดจด (Map) เพื่อให้ค้นหาได้รวดเร็ว ว่า Container รหัสไหน มีสถานะเป็นอะไร
	dockerStateMap := make(map[string]string)
	for _, dc := range dockerContainers {
		dockerStateMap[dc.ID] = dc.State // "running" หรือ "exited"
	}

	var results []map[string]interface{}
	for _, d := range deployments {
		if d.Status == "deleted" {
			continue
		}

		actualState := d.Status
		lastError := d.LastError
		if d.ContainerID != "" {
			state, exists := dockerStateMap[d.ContainerID]
			if exists {
				actualState = state
				if d.Status != actualState {
					config.DB.Model(&d).Update("status", actualState)
				}
				// ถ้า Container ดับ (exited หรือ restarting) ให้ดึง log ล่าสุดมาใส่ทันที
				if actualState == "exited" || actualState == "restarting" {
					crashLog, err := services.GetContainerLogs(context.Background(), d.ContainerID)
					if err == nil && strings.TrimSpace(crashLog) != "" {
						lastError = strings.ReplaceAll(strings.TrimSpace(crashLog), "\x00", "")
						config.DB.Model(&d).Update("last_error", lastError)
					}
				}
			} else if d.Status != "failed" {
				actualState = "deleted"
				config.DB.Model(&d).Update("status", "deleted")
				continue
			}
		}

		// ข้ามไม่เอาเซิร์ฟเวอร์ที่ถูกลบทิ้งไปแล้วมาโชว์ในหน้าเว็บ
		if actualState == "deleted" {
			continue
		}

		// ตรวจสอบว่า Container นี้ผูกกับ Managed Database ตัวไหน และ DB นั้นหยุดทำงานอยู่หรือไม่
		var linkedDBName string
		var linkedDBID uint
		var isDBStopped bool
		var dbWarning string

		var isMissingDB bool
		if d.ContainerID != "" {
			envs, err := services.GetContainerEnv(context.Background(), d.ContainerID)
			if err == nil {
				for _, env := range envs {
					trimmed := strings.TrimSpace(env)
					if trimmed == "DATABASE_URL=" || trimmed == "DB_URL=" || trimmed == "POSTGRES_URL=" {
						isMissingDB = true
						dbWarning = "DATABASE_URL ยังเป็นค่าว่างเปล่า กรุณาเชื่อมต่อ Database"
					}
					for _, db := range allDBs {
						if strings.Contains(env, db.ContainerName) || strings.Contains(env, db.InternalURL) {
							linkedDBName = db.Name
							linkedDBID = db.ID
							if db.Status != "running" {
								isDBStopped = true
								dbWarning = fmt.Sprintf("ฐานข้อมูล '%s' กำลังหยุดทำงาน (Stopped) ทำให้แอปไม่สามารถเชื่อมต่อได้", db.Name)
							}
							break
						}
					}
				}
			}
			// ตรวจสอบจาก Error Log ล่าสุดของ Container เพิ่มเติมด้วย
			if !isMissingDB && (actualState == "running" || actualState == "exited") {
				logs, err := services.GetContainerLogs(context.Background(), d.ContainerID)
				if err == nil {
					lowerLogs := strings.ToLower(logs)
					if strings.Contains(lowerLogs, "database_url resolved to an empty string") ||
						strings.Contains(lowerLogs, "you must provide a nonempty url") {
						isMissingDB = true
						dbWarning = "DATABASE_URL ว่างเปล่า: Prisma ใช้งาน Database ไม่ได้"
					}
				}
			}
		}

		// สังเกตประเภท Service จากชื่อ RepoURL
		serviceType := "standalone"
		cleanName := d.RepoURL
		if strings.HasSuffix(d.RepoURL, " (Backend)") {
			serviceType = "backend"
			cleanName = strings.TrimSuffix(d.RepoURL, " (Backend)")
		} else if strings.HasSuffix(d.RepoURL, " (Frontend)") {
			serviceType = "frontend"
			cleanName = strings.TrimSuffix(d.RepoURL, " (Frontend)")
		}

		if d.WebhookSecret == "" {
			d.WebhookSecret = GenerateRandomSecret()
			config.DB.Model(&d).Update("webhook_secret", d.WebhookSecret)
		}

		deployedAt := d.UpdatedAt
		if deployedAt.IsZero() || deployedAt.Before(d.CreatedAt) {
			deployedAt = d.CreatedAt
		}

		results = append(results, map[string]interface{}{
			"id":             d.ContainerID,
			"deployment_id":  d.ID,
			"name":           d.RepoURL, 
			"clean_name":     cleanName,
			"service_type":   serviceType,
			"image":          d.ImageName,
			"state":          actualState,
			"status":         "Deployed: " + deployedAt.Format("02 Jan 15:04"),
			"created_at":     d.CreatedAt.Format(time.RFC3339),
			"updated_at":     d.UpdatedAt.Format(time.RFC3339),
			"deployed_at":    deployedAt.Format(time.RFC3339),
			"domain_name":    d.DomainName,
			"last_error":     lastError,
			"linked_db_name": linkedDBName,
			"linked_db_id":   linkedDBID,
			"is_db_stopped":  isDBStopped,
			"is_missing_db":  isMissingDB,
			"db_warning":     dbWarning,
			"webhook_secret": d.WebhookSecret,
			"webhook_url":    fmt.Sprintf("http://localhost:8080/api/webhooks/deploy/%d", d.ID),
		})
	}
	
	c.JSON(http.StatusOK, results)
}


func StopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := services.StopContainer(context.Background(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Stop ไม่สำเร็จ: " + err.Error()})
		return
	}
	config.DB.Model(&models.Deployment{}).Where("container_id = ?", id).Update("status", "stopped")
	c.JSON(http.StatusOK, gin.H{"message": "หยุดเซิร์ฟเวอร์เรียบร้อย"})
}

func StartContainer(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()

	// 1. สั่ง Docker ให้เริ่มรัน Container
	if err := services.StartContainer(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Docker เริ่มรัน Container ไม่สำเร็จ: " + err.Error(),
			"details": err.Error(),
		})
		return
	}

	// 2. หน่วงเวลา 1.2 วินาที เพื่อเช็คว่าเมื่อแอปพลิเคชันบูตขึ้นมาแล้ว อยู่รอด หรือ Crash ดับทันที
	time.Sleep(1200 * time.Millisecond)

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()
		inspect, err := cli.ContainerInspect(ctx, id)
		if err == nil && inspect.State != nil {
			if inspect.State.Status != "running" || inspect.State.Restarting || inspect.State.ExitCode != 0 {
				// แอปดับทันที! ดึง Error Log ล่าสุดมาแสดงผลให้ผู้ใช้ทราบสาเหตุชัดเจน
				logs, _ := services.GetContainerLogs(ctx, id)
				cleanLog := strings.TrimSpace(logs)
				if cleanLog == "" {
					cleanLog = fmt.Sprintf("แอปพลิเคชันปิดการทำงานทันที (Exit Code: %d)", inspect.State.ExitCode)
				}

				config.DB.Model(&models.Deployment{}).Where("container_id = ?", id).Updates(map[string]interface{}{
					"status":     "exited",
					"last_error": cleanLog,
				})

				c.JSON(http.StatusBadRequest, gin.H{
					"error":   fmt.Sprintf("เริ่มเซิร์ฟเวอร์ไม่สำเร็จ! แอปพลิเคชันดับลงทันที (Exit Code: %d)", inspect.State.ExitCode),
					"details": cleanLog,
					"state":   "exited",
				})
				return
			}
		}
	}

	config.DB.Model(&models.Deployment{}).Where("container_id = ?", id).Updates(map[string]interface{}{
		"status":     "running",
		"last_error": "",
	})
	c.JSON(http.StatusOK, gin.H{"message": "เซิร์ฟเวอร์เริ่มทำงานเรียบร้อยแล้ว"})
}

func DeleteContainer(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()

	// 1. ลองหาใน Database ก่อนว่าตรงกับ ID (Primary Key) หรือ ContainerID
	var dep models.Deployment
	if err := config.DB.Where("id = ? OR container_id = ?", id, id).First(&dep).Error; err == nil {
		// ถ้ามี ContainerID อยู่จริงใน Docker ให้สั่งลบ Docker container
		if dep.ContainerID != "" {
			_ = services.DeleteContainer(ctx, dep.ContainerID)
		}
		// ปรับสถานะเป็น deleted ใน database
		config.DB.Model(&dep).Update("status", "deleted")
		c.JSON(http.StatusOK, gin.H{"message": "ลบเซิร์ฟเวอร์เรียบร้อย"})
		return
	}

	// 2. ถ้าหาใน Database ไม่เจอ ให้ลองลบจาก Docker โดยตรง
	if err := services.DeleteContainer(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ลบไม่สำเร็จ: " + err.Error()})
		return
	}
	config.DB.Model(&models.Deployment{}).Where("container_id = ?", id).Update("status", "deleted")
	c.JSON(http.StatusOK, gin.H{"message": "ลบเซิร์ฟเวอร์เรียบร้อย"})
}

func GetContainerLogs(c *gin.Context) {
	id :=  c.Param("id")
	ctx := context.Background()
	logs, err := services.GetContainerLogs(ctx,id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ดึง Log ไม่สำเร็จ: " + err.Error()})
		return
	}
	// ส่งค่า Log แบบตัวอักษรธรรมดา (Text) ให้ Frontend โชว์
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, logs)
}


func GetContainerStats(c *gin.Context){
	id := c.Param("id")
	ctx := context.Background()
	stats, err := services.GetContainerStats(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ดึงข้อมูลไม่สำเร็จ: " + err.Error()})
		return 
	}

	c.JSON(http.StatusOK, stats)
}

func RedeployContainer(c *gin.Context){
	id := c.Param("id")
	
	var deploy models.Deployment
	if err := config.DB.Where("container_id Like ?", id + "%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลเซิฟร์เวอร์นี้ในระบบ"})
		return
	}

	config.DB.Model(&deploy).Update("status", "redeploying")

	go func () {
		ctx := context.Background()
		newID, err := services.RedeployApp(ctx, deploy.ContainerID, deploy.RepoURL, deploy.ImageName, deploy.ForceAI, deploy.GitToken)
		if err != nil {
			fmt.Println("Redeploy ล้มเหลว:", err)
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"status":     "failed",
				"last_error": err.Error(),
			})
		} else {
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"container_id": newID[:12],
				"status":       "running",
				"last_error":   "",
				"updated_at":   time.Now(),
			})
			fmt.Println("Redeploy สำเร็จ! อัปเดต ID เซิฟร์เวอร์ใหม่เป็น", newID[:12])
		}
	}()
	c.JSON(http.StatusOK, gin.H{"message": "กำลังดึงโค้ดและ Re-deploy"})
}

// PruneImages สั่งลบ Image เก่าที่ไม่ได้ใช้งาน (Dangling) และคืนขนาดพื้นที่ว่าง
func PruneImages(c *gin.Context) {
	ctx := context.Background()
	reclaimedBytes, err := services.PruneUnusedImages(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ล้าง Image ไม่สำเร็จ: " + err.Error()})
		return
	}

	reclaimedMB := float64(reclaimedBytes) / (1024 * 1024)
	c.JSON(http.StatusOK, gin.H{
		"message":               "ทำความสะอาด Docker Image เก่าเรียบร้อยแล้ว",
		"space_reclaimed_mb":    fmt.Sprintf("%.2f", reclaimedMB),
		"space_reclaimed_bytes": reclaimedBytes,
	})
}

func GetContainerEnv(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()
	envList, err := services.GetContainerEnv(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ดึง Env ไม่สำเร็จ: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"env": envList})
}

func UpdateContainerEnv(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		EnvVars string `json:"env_vars"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	var deploy models.Deployment
	if err := config.DB.Where("container_id LIKE ?", id+"%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลใน Database"})
		return
	}

	ctx := context.Background()
	newID, err := services.UpdateContainerEnv(ctx, deploy.ContainerID, req.EnvVars)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อัปเดต Env ไม่สำเร็จ: " + err.Error()})
		return
	}

	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"container_id": newID[:12],
		"status":       "running",
		"last_error":   "",
	})

	c.JSON(http.StatusOK, gin.H{"message": "อัปเดต Environment Variables และรีสตาร์ตสำเร็จ!", "new_id": newID[:12]})
}