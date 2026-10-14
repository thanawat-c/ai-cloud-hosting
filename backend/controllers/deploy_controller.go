package controllers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

func TestDeploy(c *gin.Context) {
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูลไม่ถูกต้อง"})
		return
	}

	// 1. สร้าง "ท่อ (Channel)" สำหรับส่งข้อความหากัน
	logChan := make(chan string)

	// 2. บอก Frontend ว่า "นี่ไม่ใช่ JSON นะ! นี่คือข้อมูลที่จะทยอยส่งไปเรื่อยๆ (Chunked)"
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("Content-Type", "text/plain")

	// 3. แตกสายการทำงานไปรันอยู่เบื้องหลัง (Goroutine)
	go func() {
		// ปิดท่อทิ้งทันทีเมื่องานทั้งหมดเสร็จสิ้น (ป้องกันท่อตัน)
		defer close(logChan)
		ctx := context.Background()

		logChan <- "กำลังโคลนโค้ดจาก GitHub...\n"
		buildDir, err := services.CloneRepository(req.RepoURL)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
			return
		}
		defer os.RemoveAll(buildDir)

		dockerfilePath := filepath.Join(buildDir, "Dockerfile")
		
		if _, err := os.Stat(dockerfilePath); err == nil && !req.ForceAI {
			logChan <- "พบ Dockerfile ในโปรเจกต์ของลูกค้า ข้ามขั้นตอน AI!\n"
		} else {
			if req.ForceAI {
				logChan <- "✨ เปิดโหมด Force AI Override: กำลังให้ AI เขียน Dockerfile ทับของเดิม...\n"
			} else {
				logChan <- "ไม่พบ Dockerfile กำลังให้ AI ช่วยเขียนให้...\n"
			}
			aiDocker, err := services.GenerateDockerfile(ctx, req.RepoURL, buildDir)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
				return
			}
			os.WriteFile(dockerfilePath, []byte(aiDocker), 0644)
			logChan <- "AI เขียน Dockerfile เสร็จแล้ว!\n"
		}

		// โยนท่อส่งเข้าไปให้ BuildImage นำไปใช้
		imageName, err := services.BuildImage(ctx, buildDir, logChan)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
			return
		}

		logChan <- "กำลังเปิดเซิร์ฟเวอร์จำลอง (Container) และผูกโดเมน...\n"
		containerID, domainName, err := services.CreateAndStartContainer(ctx, imageName, req.EnvVars)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, ImageName: imageName, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
			return
		}

		// --- เริ่มส่วนที่แทรกใหม่ (บันทึกลง Database) ---
		newDeploy := models.Deployment{
			RepoURL:     req.RepoURL,
			ImageName:   imageName,
			ContainerID: containerID[:12],
			DomainName:  domainName,
			Status:      "running",
			ForceAI:     req.ForceAI,
		}

		// สั่ง GORM ให้บันทึกตัวแปร newDeploy ลงฐานข้อมูล
		if err := config.DB.Create(&newDeploy).Error; err != nil {
			logChan <- "คำเตือน: รันเซิร์ฟเวอร์สำเร็จ แต่บันทึกลงฐานข้อมูลพัง: " + err.Error() + "\n"
		} else {
			logChan <- "บันทึกประวัติการ Deploy ลงฐานข้อมูลเรียบร้อยแล้ว!\n"
		}

		// เมื่อเสร็จทั้งหมด เราส่งข้อมูลโดเมนแนบไปด้วยแบบเนียนๆ
		logChan <- fmt.Sprintf("\n SUCCESS: DOMAIN=%s ID=%s\n", domainName, containerID[:12])
	}()

	// 4. Controller มานั่งเฝ้าปลายท่อ
	// for วนลูปอ่านข้อความจากท่อไปเรื่อยๆ จนกว่าท่อจะถูกปิด (close)
	for msg := range logChan {
		// พ่นข้อความไปให้ Frontend ทันที
		c.Writer.Write([]byte(msg))
		c.Writer.Flush() 
	}
}

