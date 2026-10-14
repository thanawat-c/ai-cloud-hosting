package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

func GetContainers(c *gin.Context) {
	// 1. ดึงประวัติทั้งหมดจาก Database (ไม่รวมที่ลบทิ้งไปแล้ว)
	var deployments []models.Deployment
	config.DB.Where("status != ?", "deleted").Order("created_at desc").Find(&deployments)

	// 2. ดึงสถานะปัจจุบันของ Container ที่รันอยู่ใน Docker จริงๆ ทั้งหมด
	dockerContainers, _ := services.ListContainers(context.Background())
	
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
		if d.ContainerID != "" {
			state, exists := dockerStateMap[d.ContainerID]
			if exists {
				actualState = state
				if d.Status != actualState {
					config.DB.Model(&d).Update("status", actualState)
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

		results = append(results, map[string]interface{}{
			"id":            d.ContainerID,
			"deployment_id": d.ID,
			"name":          d.RepoURL, 
			"clean_name":    cleanName,
			"service_type":  serviceType,
			"image":         d.ImageName,
			"state":         actualState,
			"status":        "Deployed: " + d.CreatedAt.Format("02 Jan 15:04"),
			"domain_name":   d.DomainName,
			"last_error":    d.LastError,
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
	if err := services.StartContainer(context.Background(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Start ไม่สำเร็จ: " + err.Error()})
		return
	}
	config.DB.Model(&models.Deployment{}).Where("container_id = ?", id).Update("status", "running")
	c.JSON(http.StatusOK, gin.H{"message": "เซิร์ฟเวอร์กลับมาทำงานแล้ว"})
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

	go func () {
		ctx := context.Background()
		newID, err := services.RedeployApp(ctx, deploy.ContainerID, deploy.RepoURL, deploy.ImageName, deploy.ForceAI)
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
			})
			fmt.Println("Redeploy สำเร็จ! อัปเดต ID เซิฟร์เวอร์ใหม่เป็น", newID[:12])
		}
	}()
	c.JSON(http.StatusOK, gin.H{"message": "กำลังดึงโค้ดและ Re-deploy"})
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