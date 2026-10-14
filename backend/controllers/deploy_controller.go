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

		// ให้ AI ช่วยวิเคราะห์ว่าเป็น Monorepo หรือไม่ และโฟลเดอร์ไหนคือ Frontend / Backend (ไม่ยึดติดกับชื่อโฟลเดอร์)
		isMonorepo, feDirName, beDirName := services.DetectMonorepoServices(ctx, buildDir)

		if isMonorepo {
			logChan <- fmt.Sprintf("⚡ ตรวจพบ Fullstack Monorepo! (Backend: '%s/', Frontend: '%s/')\nระบบจะทำการแยก Deploy 2 Services ให้โดยอัตโนมัติ...\n", beDirName, feDirName)

			// --- 1. DEPLOY BACKEND FIRST ---
			logChan <- "\n=========================================\n"
			logChan <- fmt.Sprintf("🚀 ขั้นตอนที่ 1/2: กำลังเตรียม Deploy [Backend Service: %s/]...\n", beDirName)
			logChan <- "=========================================\n"

			backendDockerfile := filepath.Join(buildDir, "Dockerfile.backend")
			aiBackendDocker, backendPort, err := services.GenerateDockerfile(ctx, req.RepoURL, buildDir, beDirName)
			if err != nil {
				logChan <- "Error: AI สร้าง Dockerfile Backend ไม่สำเร็จ: " + err.Error() + "\n"
				return
			}
			os.WriteFile(backendDockerfile, []byte(aiBackendDocker), 0644)
			// เอาไปเขียนทับ Dockerfile หลักชั่วคราวเพื่อ build backend
			os.WriteFile(filepath.Join(buildDir, "Dockerfile"), []byte(aiBackendDocker), 0644)

			logChan <- "กำลัง Build Backend Image...\n"
			backendImageName, err := services.BuildImage(ctx, buildDir, logChan)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			logChan <- fmt.Sprintf("กำลังรัน Backend Container (พอร์ต %s)...\n", backendPort)
			beContainerID, beDomainName, err := services.CreateAndStartContainer(ctx, backendImageName, req.EnvVars, backendPort)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			config.DB.Create(&models.Deployment{
				RepoURL:     req.RepoURL + " (Backend)",
				ImageName:   backendImageName,
				ContainerID: beContainerID[:12],
				DomainName:  beDomainName,
				Status:      "running",
				ForceAI:     req.ForceAI,
			})
			logChan <- fmt.Sprintf("✅ Backend รันสำเร็จที่: http://%s\n", beDomainName)

			// --- 2. DEPLOY FRONTEND AND INJECT BACKEND URL ---
			logChan <- "\n=========================================\n"
			logChan <- fmt.Sprintf("🎨 ขั้นตอนที่ 2/2: กำลังเตรียม Deploy [Frontend Service: %s/]...\n", feDirName)
			logChan <- fmt.Sprintf("🔗 ผูก API Endpoint: NUXT_PUBLIC_API_URL=http://%s\n", beDomainName)
			logChan <- "=========================================\n"

			aiFrontendDocker, fePort, err := services.GenerateDockerfile(ctx, req.RepoURL, buildDir, feDirName)
			if err != nil {
				logChan <- "Error: AI สร้าง Dockerfile Frontend ไม่สำเร็จ: " + err.Error() + "\n"
				return
			}
			os.WriteFile(filepath.Join(buildDir, "Dockerfile"), []byte(aiFrontendDocker), 0644)

			logChan <- "กำลัง Build Frontend Image...\n"
			frontendImageName, err := services.BuildImage(ctx, buildDir, logChan)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			// ส่ง URL ของ Backend เข้าไปให้ Frontend ทั้งรูปแบบ Vite, Nuxt และ Next
			feEnvVars := req.EnvVars
			if feEnvVars != "" {
				feEnvVars += "\n"
			}
			feEnvVars += fmt.Sprintf("NUXT_PUBLIC_API_URL=http://%s\nVITE_API_URL=http://%s\nAPI_URL=http://%s\nREACT_APP_API_URL=http://%s", beDomainName, beDomainName, beDomainName, beDomainName)

			logChan <- "กำลังรัน Frontend Container...\n"
			feContainerID, feDomainName, err := services.CreateAndStartContainer(ctx, frontendImageName, feEnvVars, fePort)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			config.DB.Create(&models.Deployment{
				RepoURL:     req.RepoURL + " (Frontend)",
				ImageName:   frontendImageName,
				ContainerID: feContainerID[:12],
				DomainName:  feDomainName,
				Status:      "running",
				ForceAI:     req.ForceAI,
			})

			logChan <- fmt.Sprintf("\n🎉 สำเร็จครบทั้ง 2 ระบบ!\nBackend API: http://%s\nFrontend UI: http://%s\n", beDomainName, feDomainName)
			logChan <- fmt.Sprintf("\n SUCCESS: DOMAIN=%s ID=%s\n", feDomainName, feContainerID[:12])
			return
		}

		// --- สำหรับโปรเจกต์เดี่ยวทั่วไป (ไม่ใช่ Monorepo) ---
		dockerfilePath := filepath.Join(buildDir, "Dockerfile")
		targetPort := "80"

		if _, err := os.Stat(dockerfilePath); err == nil && !req.ForceAI {
			logChan <- "พบ Dockerfile ในโปรเจกต์ของลูกค้า ข้ามขั้นตอน AI!\n"
		} else {
			if req.ForceAI {
				logChan <- "✨ เปิดโหมด Force AI Override: กำลังให้ AI เขียน Dockerfile ทับของเดิม...\n"
			} else {
				logChan <- "ไม่พบ Dockerfile กำลังให้ AI ช่วยเขียนให้...\n"
			}
			aiDocker, port, err := services.GenerateDockerfile(ctx, req.RepoURL, buildDir, "")
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
				return
			}
			targetPort = port
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

		logChan <- fmt.Sprintf("กำลังเปิดเซิร์ฟเวอร์จำลอง (Container) พอร์ต %s และผูกโดเมน...\n", targetPort)
		containerID, domainName, err := services.CreateAndStartContainer(ctx, imageName, req.EnvVars, targetPort)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			config.DB.Create(&models.Deployment{RepoURL: req.RepoURL, ImageName: imageName, Status: "failed", LastError: err.Error(), ForceAI: req.ForceAI})
			return
		}

		// บันทึกลง Database
		newDeploy := models.Deployment{
			RepoURL:     req.RepoURL,
			ImageName:   imageName,
			ContainerID: containerID[:12],
			DomainName:  domainName,
			Status:      "running",
			ForceAI:     req.ForceAI,
		}

		if err := config.DB.Create(&newDeploy).Error; err != nil {
			logChan <- "คำเตือน: รันเซิร์ฟเวอร์สำเร็จ แต่บันทึกลงฐานข้อมูลพัง: " + err.Error() + "\n"
		} else {
			logChan <- "บันทึกประวัติการ Deploy ลงฐานข้อมูลเรียบร้อยแล้ว!\n"
		}

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

