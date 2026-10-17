package controllers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

func TestDeploy(c *gin.Context) {
	var req models.DeployRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// 1. Channel for streaming deployment progress
	logChan := make(chan string)

	// 2. Chunked Transfer-Encoding response
	c.Writer.Header().Set("Transfer-Encoding", "chunked")
	c.Writer.Header().Set("Content-Type", "text/plain")

	// 3. Background deployment worker
	go func() {
		defer close(logChan)
		ctx := context.Background()

		logChan <- "Cloning repository from GitHub...\n"
		buildDir, err := services.CloneRepository(req.RepoURL, req.GitToken)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			return
		}
		defer os.RemoveAll(buildDir)

		// Auto-provision dedicated database if requested
		if req.AutoCreateDB {
			logChan <- "🐘 [Auto-DB] Auto-provisioning dedicated PostgreSQL database...\n"
			dbBaseName := filepath.Base(strings.TrimSpace(req.RepoURL))
			dbBaseName = strings.TrimSuffix(dbBaseName, ".git")
			if dbBaseName == "" || dbBaseName == "." {
				dbBaseName = "app-db"
			}
			newDB, err := services.CreateManagedDatabase(ctx, models.CreateDatabaseRequest{
				Name: dbBaseName,
				Type: "postgres",
			})
			if err != nil {
				logChan <- fmt.Sprintf("⚠️ Warning: Auto-provision DB failed: %v (continuing deployment)\n", err)
			} else {
				logChan <- fmt.Sprintf("✅ Dedicated PostgreSQL created: '%s' (Container: %s)\n", newDB.Name, newDB.ContainerName)
				logChan <- "🔗 Automatically binding DATABASE_URL to environment variables...\n"
				dbAliases := fmt.Sprintf("\nDATABASE_URL=%s\nDB_URL=%s\nPOSTGRES_URL=%s\nDB_HOST=%s\nDB_PORT=5432\nDB_USER=postgres\nDB_PASSWORD=%s\nDB_NAME=%s",
					newDB.InternalURL,
					newDB.InternalURL,
					newDB.InternalURL,
					newDB.ContainerName,
					newDB.Password,
					newDB.DBName,
				)

				// Strip existing empty DB keys to prevent duplicate keys in container environment
				dbKeysToRemove := map[string]bool{
					"DATABASE_URL": true, "DB_URL": true, "POSTGRES_URL": true,
					"DB_HOST": true, "DB_PORT": true, "DB_USER": true,
					"DB_PASSWORD": true, "DB_NAME": true,
					"POSTGRES_USER": true, "POSTGRES_PASSWORD": true, "POSTGRES_DB": true,
				}
				var filteredLines []string
				for _, line := range strings.Split(req.EnvVars, "\n") {
					trimmedLine := strings.TrimSpace(line)
					if trimmedLine == "" {
						continue
					}
					parts := strings.SplitN(trimmedLine, "=", 2)
					key := strings.ToUpper(strings.TrimSpace(parts[0]))
					if dbKeysToRemove[key] {
						continue
					}
					filteredLines = append(filteredLines, line)
				}
				req.EnvVars = strings.Join(filteredLines, "\n") + dbAliases
			}
		}

		// Auto execute repository SQL schemas if connected to database
		services.AutoExecuteRepoSQL(ctx, buildDir, req.EnvVars, logChan)

		// Detect if repository is a monorepo
		isMonorepo, feDirName, beDirName := services.DetectMonorepoServices(ctx, buildDir)

		if isMonorepo {
			logChan <- fmt.Sprintf("⚡ Fullstack Monorepo detected: (Backend: '%s/', Frontend: '%s/')\nDeploying 2 independent microservices automatically...\n", beDirName, feDirName)

			// --- 1. DEPLOY BACKEND FIRST ---
			logChan <- "\n=========================================\n"
			logChan <- fmt.Sprintf("🚀 [1/2] Preparing Backend Service: '%s/'...\n", beDirName)
			logChan <- "=========================================\n"

			backendDir := filepath.Join(buildDir, beDirName)
			backendDockerfile := filepath.Join(backendDir, "Dockerfile")
			aiBackendDocker, backendPort, err := services.GenerateDockerfile(ctx, req.RepoURL, backendDir, beDirName)
			if err != nil {
				logChan <- "Error: Failed to generate Dockerfile for backend: " + err.Error() + "\n"
				return
			}
			os.WriteFile(backendDockerfile, []byte(aiBackendDocker), 0644)

			baseImageName := "my-app-" + filepath.Base(buildDir)

			logChan <- "Building backend container image...\n"
			backendImageName, err := services.BuildImage(ctx, backendDir, logChan, baseImageName+"-backend")
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			logChan <- fmt.Sprintf("Starting backend container (Port %s)...\n", backendPort)
			beContainerID, beDomainName, err := services.CreateAndStartContainer(ctx, backendImageName, req.EnvVars, backendPort)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			if strings.Contains(req.EnvVars, "DATABASE_URL=") {
				services.AutoSyncPrismaSchema(beContainerID)
			}

			config.DB.Create(&models.Deployment{
				RepoURL:     req.RepoURL + " (Backend)",
				GitToken:    req.GitToken,
				ImageName:   backendImageName,
				ContainerID: beContainerID[:12],
				DomainName:  beDomainName,
				Status:      "running",
				ForceAI:     req.ForceAI,
			})
			logChan <- fmt.Sprintf("✅ Backend service live at: http://%s\n", beDomainName)

			// --- 2. DEPLOY FRONTEND AND INJECT BACKEND URL ---
			logChan <- "\n=========================================\n"
			logChan <- fmt.Sprintf("🎨 [2/2] Preparing Frontend Service: '%s/'...\n", feDirName)
			logChan <- fmt.Sprintf("🔗 Binding Backend API: http://%s\n", beDomainName)
			logChan <- "=========================================\n"

			frontendDir := filepath.Join(buildDir, feDirName)
			frontendDockerfile := filepath.Join(frontendDir, "Dockerfile")
			backendInternalEndpoint := fmt.Sprintf("%s:%s", backendImageName, backendPort)
			backendPublicURL := fmt.Sprintf("http://%s", beDomainName)
			aiFrontendDocker, fePort, err := services.GenerateDockerfile(ctx, req.RepoURL, frontendDir, feDirName, backendPublicURL)
			if err != nil {
				logChan <- "Error: Failed to generate Dockerfile for frontend: " + err.Error() + "\n"
				return
			}
			os.WriteFile(frontendDockerfile, []byte(aiFrontendDocker), 0644)

			// สร้างไฟล์ nginx.conf สำหรับ Reverse Proxy ให้ชัวร์ 100%
			// ใช้ resolver 127.0.0.11 (Docker DNS) และ set ตัวแปร เพื่อไม่ให้ Nginx แครชตอนสตาร์ตถ้า backend ดับอยู่
			// location /api รองรับทั้ง /api, /api/ และ /api/v1/...
			nginxConf := fmt.Sprintf(`server {
    listen 80;
    server_name localhost;

    # ใช้ Docker Internal DNS ในการ Resolve ชื่อเครื่อง
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
`, backendInternalEndpoint)
			os.WriteFile(filepath.Join(frontendDir, "nginx.conf"), []byte(nginxConf), 0644)

			logChan <- "Building frontend container image...\n"
			frontendImageName, err := services.BuildImage(ctx, frontendDir, logChan, baseImageName+"-frontend")
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			// ส่ง URL ของ Backend เข้าไปให้ Frontend ทั้งรูปแบบ Vite, Nuxt และ Next
			// กรองไม่ส่งข้อมูลการเชื่อมต่อ Database หรือ Secrets หลังบ้านไปให้ Frontend
			var feCleanEnvLines []string
			for _, line := range strings.Split(req.EnvVars, "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				keyUpper := strings.ToUpper(strings.TrimSpace(parts[0]))
				// ตัดตัวแปรที่เกี่ยวกับฐานข้อมูล หรือ credentials หลังบ้านออก
				if strings.Contains(keyUpper, "DATABASE") ||
					strings.Contains(keyUpper, "POSTGRES") ||
					strings.Contains(keyUpper, "MYSQL") ||
					strings.Contains(keyUpper, "MONGO") ||
					strings.Contains(keyUpper, "REDIS") ||
					strings.HasPrefix(keyUpper, "DB_") ||
					strings.Contains(keyUpper, "SECRET") ||
					strings.Contains(keyUpper, "PASSWORD") {
					continue
				}
				feCleanEnvLines = append(feCleanEnvLines, line)
			}
			feEnvVars := strings.Join(feCleanEnvLines, "\n")
			if feEnvVars != "" {
				feEnvVars += "\n"
			}
			backendInternalURL := fmt.Sprintf("http://%s", backendInternalEndpoint)
			backendPublicURL = fmt.Sprintf("http://%s", beDomainName)

			// สแกนหาตัวแปร API ทั้งหมดที่ Frontend เรียกใช้จริงแบบไดนามิก 100%
			feApiKeys := services.DetectFrontendAPIEnvKeys(frontendDir)
			for _, k := range feApiKeys {
				feEnvVars += fmt.Sprintf("\n%s=%s", k, backendPublicURL)
			}
			feEnvVars += fmt.Sprintf("\nBACKEND_URL=%s\nINTERNAL_API_URL=%s", backendInternalURL, backendInternalURL)

			logChan <- "Starting frontend container...\n"
			feContainerID, feDomainName, err := services.CreateAndStartContainer(ctx, frontendImageName, feEnvVars, fePort)
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}

			config.DB.Create(&models.Deployment{
				RepoURL:     req.RepoURL + " (Frontend)",
				GitToken:    req.GitToken,
				ImageName:   frontendImageName,
				ContainerID: feContainerID[:12],
				DomainName:  feDomainName,
				Status:      "running",
				ForceAI:     req.ForceAI,
			})

			// Prune old unused images in background
			go services.PruneUnusedImages(context.Background())

			logChan <- fmt.Sprintf("\n🎉 Fullstack services deployed successfully!\nBackend API: http://%s\nFrontend UI: http://%s\n", beDomainName, feDomainName)
			logChan <- fmt.Sprintf("\n SUCCESS: DOMAIN=%s ID=%s\n", feDomainName, feContainerID[:12])
			return
		}

		// --- Single standalone service ---
		dockerfilePath := filepath.Join(buildDir, "Dockerfile")
		targetPort := "80"

		if _, err := os.Stat(dockerfilePath); err == nil && !req.ForceAI {
			logChan <- "Repository Dockerfile detected. Skipping automated generation.\n"
		} else {
			if req.ForceAI {
				logChan <- "✨ Force AI Override enabled: Generating new Dockerfile...\n"
			} else {
				logChan <- "No Dockerfile found. Analyzing codebase and generating Dockerfile...\n"
			}
			aiDocker, port, err := services.GenerateDockerfile(ctx, req.RepoURL, buildDir, "")
			if err != nil {
				logChan <- "Error: " + err.Error() + "\n"
				return
			}
			targetPort = port
			os.WriteFile(dockerfilePath, []byte(aiDocker), 0644)
			logChan <- "Dockerfile generated successfully.\n"
		}

		// โยนท่อส่งเข้าไปให้ BuildImage นำไปใช้
		imageName, err := services.BuildImage(ctx, buildDir, logChan)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			return
		}

		logChan <- fmt.Sprintf("Starting container on port %s and configuring Traefik gateway...\n", targetPort)
		containerID, domainName, err := services.CreateAndStartContainer(ctx, imageName, req.EnvVars, targetPort)
		if err != nil {
			logChan <- "Error: " + err.Error() + "\n"
			return
		}

		// Record in database
		newDeploy := models.Deployment{
			RepoURL:     req.RepoURL,
			GitToken:    req.GitToken,
			ImageName:   imageName,
			ContainerID: containerID[:12],
			DomainName:  domainName,
			Status:      "running",
			ForceAI:     req.ForceAI,
		}

		if err := config.DB.Create(&newDeploy).Error; err != nil {
			logChan <- "Warning: Container started but failed to record deployment in database: " + err.Error() + "\n"
		} else {
			logChan <- "Deployment recorded to database.\n"
		}

		// Prune old unused images in background
		go services.PruneUnusedImages(context.Background())

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

// InspectRepo วิเคราะห์โค้ดและค้นหาตัวแปร Environment Variables ที่แอปต้องการ
func InspectRepo(c *gin.Context) {
	var req struct {
		RepoURL  string `json:"repo_url"`
		GitToken string `json:"git_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.RepoURL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุ repo_url ให้ถูกต้อง"})
		return
	}

	result, err := services.InspectRepository(strings.TrimSpace(req.RepoURL), req.GitToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "สแกน Repo ไม่สำเร็จ: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

