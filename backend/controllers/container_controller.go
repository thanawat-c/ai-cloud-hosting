package controllers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
)

func GetContainers(c *gin.Context) {
	// ล้างประวัติ Deployment ผีที่ไม่มี Container จริงๆ (เช่น พิมพ์ URL มั่วแล้ว Clone ไม่ผ่าน)
	config.DB.Where("container_id = '' OR container_id IS NULL").Delete(&models.Deployment{})

	wsID := utils.GetWorkspaceID(c)

	// 1. ดึงประวัติทั้งหมดจาก Database (เฉพาะที่มี ContainerID จริง และไม่รวมที่ลบทิ้งไปแล้ว ตาม Workspace)
	var deployments []models.Deployment
	query := config.DB.Where("status != ? AND container_id != ''", "deleted")
	if wsID != "" {
		query = query.Where("workspace_id = ?", wsID)
	}
	query.Order("created_at desc").Find(&deployments)

	// 2. ดึงสถานะปัจจุบันของ Container ที่รันอยู่ใน Docker จริงๆ ทั้งหมด
	dockerContainers, _ := services.ListContainers(context.Background())
	
	// ดึงรายการ Managed Database ทั้งหมดของ Workspace นี้ (รวมถึงที่ถูกลบไปแล้ว เพื่อเช็คว่า Service เดิมเคยผูกกับ DB ที่ถูกลบหรือไม่)
	var allDBs []models.ManagedDatabase
	dbQuery := config.DB.Model(&models.ManagedDatabase{})
	if wsID != "" {
		dbQuery = dbQuery.Where("workspace_id = ?", wsID)
	}
	dbQuery.Find(&allDBs)

	// สร้างสมุดจด (Map) เพื่อให้ค้นหาได้รวดเร็ว ว่า Container รหัสไหน มีสถานะเป็นอะไร (รองรับทั้ง short 12-char และ full 64-char ID)
	dockerStateMap := make(map[string]string)
	for _, dc := range dockerContainers {
		dockerStateMap[dc.ID] = dc.State // "running" หรือ "exited"
		if len(dc.ID) >= 12 {
			dockerStateMap[dc.ID[:12]] = dc.State
		}
	}

	var results []map[string]interface{}
	for _, d := range deployments {
		if d.Status == "deleted" {
			continue
		}

		actualState := d.Status
		lastError := d.LastError
		if d.ContainerID != "" {
			cleanCID := d.ContainerID
			if len(cleanCID) > 12 {
				cleanCID = cleanCID[:12]
			}
			state, exists := dockerStateMap[cleanCID]
			if !exists {
				state, exists = dockerStateMap[d.ContainerID]
			}
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

		// สังเกตประเภท Service จากชื่อ RepoURL ก่อนเป็นอันดับแรก
		serviceType := "standalone"
		cleanName := d.RepoURL
		if strings.HasSuffix(d.RepoURL, " (Backend)") {
			serviceType = "backend"
			cleanName = strings.TrimSuffix(d.RepoURL, " (Backend)")
		} else if strings.HasSuffix(d.RepoURL, " (Frontend)") {
			serviceType = "frontend"
			cleanName = strings.TrimSuffix(d.RepoURL, " (Frontend)")
		}

		// ตรวจสอบว่า Container นี้ผูกกับ Managed Database ตัวไหน และ DB นั้นหยุดทำงาน/ถูกลบ หรือไม่
		var linkedDBName string
		var linkedDBID uint
		var isDBStopped bool
		var dbWarning string
		var isMissingDB bool

		// Frontend is a web interface and never connects directly to a database.
		if serviceType != "frontend" && d.ContainerID != "" {
			envs, err := services.GetContainerEnv(context.Background(), d.ContainerID)
			if err == nil {
				// Parse environment variables into a key-value map.
				// Later non-empty values take precedence over earlier empty values.
				envMap := make(map[string]string)
				for _, env := range envs {
					trimmed := strings.TrimSpace(env)
					if trimmed == "" || strings.HasPrefix(trimmed, "#") {
						continue
					}
					parts := strings.SplitN(trimmed, "=", 2)
					if len(parts) == 2 {
						key := strings.ToUpper(strings.TrimSpace(parts[0]))
						val := strings.TrimSpace(parts[1])
						if val != "" || envMap[key] == "" {
							envMap[key] = val
						}
					}
				}

				// Find the effective database URL
				dbUrl := envMap["DATABASE_URL"]
				if dbUrl == "" {
					dbUrl = envMap["DB_URL"]
				}
				if dbUrl == "" {
					dbUrl = envMap["POSTGRES_URL"]
				}

				// Check if the service specifies a DB key but its effective value is empty
				_, hasDbUrlKey := envMap["DATABASE_URL"]
				if !hasDbUrlKey {
					_, hasDbUrlKey = envMap["DB_URL"]
				}
				if !hasDbUrlKey {
					_, hasDbUrlKey = envMap["POSTGRES_URL"]
				}

				if hasDbUrlKey && dbUrl == "" {
					isMissingDB = true
					dbWarning = "DATABASE_URL is empty. Please attach a database."
				} else if dbUrl != "" {
					// A database URL is provided! Check which managed DB it connects to
					foundManagedDB := false
					for _, db := range allDBs {
						if strings.Contains(dbUrl, db.ContainerName) || (db.InternalURL != "" && strings.Contains(dbUrl, db.InternalURL)) {
							foundManagedDB = true
							linkedDBName = db.Name
							linkedDBID = db.ID
							if db.Status == "deleted" {
								isMissingDB = true
								dbWarning = fmt.Sprintf("Database '%s' was deleted. Please attach a new database.", db.Name)
							} else if db.Status != "running" {
								isDBStopped = true
								dbWarning = fmt.Sprintf("Database '%s' is stopped. Application cannot connect.", db.Name)
							} else {
								// Check docker status for db
								if state, ok := dockerStateMap[db.ContainerID]; !ok || state != "running" {
									isDBStopped = true
									dbWarning = fmt.Sprintf("Database '%s' is offline on server.", db.Name)
								} else {
									isMissingDB = false
									isDBStopped = false
									dbWarning = ""
								}
							}
							break
						}
					}

					// If it points to a cloud-db-xxx container that is not found or deleted
					if !foundManagedDB && strings.Contains(dbUrl, "cloud-db-") {
						hasLiveDB := false
						for _, dc := range dockerContainers {
							cleanDcName := strings.TrimPrefix(dc.Name, "/")
							if strings.Contains(cleanDcName, "cloud-db-") && strings.Contains(dbUrl, cleanDcName) && dc.State == "running" {
								hasLiveDB = true
								break
							}
						}
						if !hasLiveDB {
							isMissingDB = true
							dbWarning = "Attached database was deleted or not found. Please attach a database."
						}
					}
				}
			}

			// Check container error logs for backend / standalone
			if !isMissingDB && !isDBStopped && (actualState == "running" || actualState == "exited") {
				logs, err := services.GetContainerLogs(context.Background(), d.ContainerID)
				if err == nil {
					lowerLogs := strings.ToLower(logs)
					if strings.Contains(lowerLogs, "database_url resolved to an empty string") ||
						strings.Contains(lowerLogs, "you must provide a nonempty url") {
						isMissingDB = true
						dbWarning = "DATABASE_URL is empty: Prisma cannot connect to database."
					} else if strings.Contains(lowerLogs, "can't reach database server") ||
						strings.Contains(lowerLogs, "code: 'p1001'") ||
						strings.Contains(lowerLogs, "code: \"p1001\"") ||
						strings.Contains(lowerLogs, "prismaclientinitializationerror") ||
						strings.Contains(lowerLogs, "connect econnrefused") ||
						strings.Contains(lowerLogs, "connection refused") ||
						strings.Contains(lowerLogs, "could not connect to server") ||
						strings.Contains(lowerLogs, "password authentication failed") ||
						strings.Contains(lowerLogs, "fatal: database") {
						isMissingDB = true
						if dbWarning == "" {
							if linkedDBName != "" {
								dbWarning = fmt.Sprintf("Cannot reach database '%s' (Connection Refused / P1001)", linkedDBName)
							} else {
								dbWarning = "Cannot reach database server (Connection Refused / P1001)"
							}
						}
					}
				}
			}
		}

		if d.WebhookSecret == "" {
			d.WebhookSecret = GenerateRandomSecret()
			config.DB.Model(&d).Update("webhook_secret", d.WebhookSecret)
		}

		deployedAt := d.UpdatedAt
		if deployedAt.IsZero() || deployedAt.Before(d.CreatedAt) {
			deployedAt = d.CreatedAt
		}

		// กำหนด Branch, Commit Hash, Author Name และ Author Avatar ให้สมบูรณ์
		branch := d.Branch
		if branch == "" {
			branch = "main"
		}

		commitHash := d.CommitHash
		if commitHash == "" && d.ContainerID != "" {
			if len(d.ContainerID) >= 7 {
				commitHash = d.ContainerID[:7]
			} else {
				commitHash = d.ContainerID
			}
		}

		authorName := d.AuthorName
		authorAvatar := d.AuthorAvatar
		if authorName == "" {
			if strings.Contains(d.RepoURL, "github.com/") {
				trimmed := strings.Split(d.RepoURL, "github.com/")[1]
				parts := strings.Split(trimmed, "/")
				if len(parts) >= 1 && parts[0] != "" {
					authorName = strings.TrimSpace(parts[0])
					if authorAvatar == "" {
						authorAvatar = fmt.Sprintf("https://github.com/%s.png?size=64", authorName)
					}
				}
			}
		}
		if authorName == "" {
			authorName = "Developer"
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
			"domain_name":         d.DomainName,
			"custom_domain":       d.CustomDomain,
			"ssl_enabled":         d.SSLEnabled,
			"ssl_status":          d.SSLStatus,
			"ssl_force_redirect":  d.SSLForceRedirect,
			"last_error":          lastError,
			"branch":         branch,
			"commit_hash":    commitHash,
			"commit_message": d.CommitMessage,
			"author_name":    authorName,
			"author_avatar":  authorAvatar,
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


func findDeployment(id string) models.Deployment {
	var dep models.Deployment
	if uintID, err := strconv.ParseUint(id, 10, 64); err == nil {
		config.DB.Where("id = ? OR container_id = ?", uintID, id).First(&dep)
	} else {
		config.DB.Where("container_id LIKE ?", id+"%").First(&dep)
	}
	return dep
}

func getDeploymentDisplayName(dep models.Deployment, fallback string) string {
	if dep.RepoURL != "" {
		clean := strings.TrimSuffix(dep.RepoURL, ".git")
		parts := strings.Split(clean, "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}
	if dep.ImageName != "" {
		return dep.ImageName
	}
	return fallback
}

func StopContainer(c *gin.Context) {
	id := c.Param("id")
	if err := services.StopContainer(context.Background(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop container: " + err.Error()})
		return
	}
	dep := findDeployment(id)
	config.DB.Model(&models.Deployment{}).Where("container_id LIKE ? OR id = ?", id+"%", dep.ID).Update("status", "stopped")

	wsID := dep.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(dep, id)
	utils.CreateNotification(wsID, "Service Stopped", fmt.Sprintf("Service '%s' has been stopped", serviceName), "warning", serviceName)

	c.JSON(http.StatusOK, gin.H{"message": "Service stopped successfully"})
}

func StartContainer(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()

	// 1. Start container via Docker
	if err := services.StartContainer(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Docker failed to start container: " + err.Error(),
			"details": err.Error(),
		})
		return
	}

	// 2. Wait 1.2s to detect immediate crash / reboot failure
	time.Sleep(1200 * time.Millisecond)

	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err == nil {
		defer cli.Close()
		inspect, err := cli.ContainerInspect(ctx, id)
		if err == nil && inspect.State != nil {
			if inspect.State.Status != "running" || inspect.State.Restarting || inspect.State.ExitCode != 0 {
				logs, _ := services.GetContainerLogs(ctx, id)
				cleanLog := strings.TrimSpace(logs)
				if cleanLog == "" {
					cleanLog = fmt.Sprintf("Application terminated unexpectedly (Exit Code: %d)", inspect.State.ExitCode)
				}

				dep := findDeployment(id)
				wsID := dep.WorkspaceID
				if wsID == "" {
					wsID = utils.GetWorkspaceID(c)
				}
				serviceName := getDeploymentDisplayName(dep, id)
				utils.CreateNotification(wsID, "Service Start Failed", fmt.Sprintf("Service '%s' failed to boot (Exit Code: %d)", serviceName, inspect.State.ExitCode), "error", serviceName)

				c.JSON(http.StatusBadRequest, gin.H{
					"error":   fmt.Sprintf("Failed to start service: container crashed immediately (Exit Code: %d)", inspect.State.ExitCode),
					"details": cleanLog,
					"state":   "exited",
				})
				return
			}
		}
	}

	dep := findDeployment(id)
	config.DB.Model(&models.Deployment{}).Where("container_id LIKE ? OR id = ?", id+"%", dep.ID).Updates(map[string]interface{}{
		"status":     "running",
		"last_error": "",
	})

	wsID := dep.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(dep, id)
	utils.CreateNotification(wsID, "Service Started", fmt.Sprintf("Service '%s' is now running", serviceName), "info", serviceName)

	c.JSON(http.StatusOK, gin.H{"message": "Service started successfully"})
}

func DeleteContainer(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()

	dep := findDeployment(id)
	if dep.ID != 0 {
		if dep.ContainerID != "" {
			_ = services.DeleteContainer(ctx, dep.ContainerID)
		}
		config.DB.Model(&dep).Update("status", "deleted")

		wsID := dep.WorkspaceID
		if wsID == "" {
			wsID = utils.GetWorkspaceID(c)
		}
		serviceName := getDeploymentDisplayName(dep, id)
		utils.CreateNotification(wsID, "Service Deleted", fmt.Sprintf("Service '%s' was deleted", serviceName), "warning", serviceName)

		c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
		return
	}

	// 2. Fallback to delete directly via Docker if not found in Database
	if err := services.DeleteContainer(ctx, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete container: " + err.Error()})
		return
	}
	config.DB.Model(&models.Deployment{}).Where("container_id LIKE ?", id+"%").Update("status", "deleted")
	wsID := utils.GetWorkspaceID(c)
	utils.CreateNotification(wsID, "Service Deleted", fmt.Sprintf("Container %s was deleted", id), "warning", id)
	c.JSON(http.StatusOK, gin.H{"message": "Service deleted successfully"})
}

func GetContainerLogs(c *gin.Context) {
	id :=  c.Param("id")
	ctx := context.Background()
	logs, err := services.GetContainerLogs(ctx,id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs: " + err.Error()})
		return
	}
	// Return raw text logs for frontend terminal viewer
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, logs)
}


func GetContainerStats(c *gin.Context){
	id := c.Param("id")
	ctx := context.Background()
	stats, err := services.GetContainerStats(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch metrics: " + err.Error()})
		return 
	}

	c.JSON(http.StatusOK, stats)
}

func RedeployContainer(c *gin.Context){
	id := c.Param("id")
	
	var deploy models.Deployment
	if err := config.DB.Where("container_id Like ?", id + "%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Service not found"})
		return
	}

	config.DB.Model(&deploy).Update("status", "redeploying")

	go func() {
		ctx := context.Background()
		wsID := deploy.WorkspaceID
		if wsID == "" {
			wsID = "personal"
		}
		serviceName := getDeploymentDisplayName(deploy, id)

		newID, err := services.RedeployApp(ctx, deploy.ContainerID, deploy.RepoURL, deploy.ImageName, deploy.ForceAI, deploy.GitToken)
		if err != nil {
			fmt.Println("Redeploy ล้มเหลว:", err)
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"status":     "failed",
				"last_error": err.Error(),
			})
			utils.CreateNotification(wsID, "Redeploy Failed", fmt.Sprintf("Service '%s' manual rebuild failed: %s", serviceName, err.Error()), "error", serviceName)
		} else {
			cleanID := newID
			if len(cleanID) > 12 {
				cleanID = cleanID[:12]
			}
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"container_id": cleanID,
				"status":       "running",
				"last_error":   "",
				"updated_at":   time.Now(),
			})

			// บันทึก Release ใหม่ และปลด active จากรอบก่อน
			config.DB.Model(&models.DeploymentRelease{}).Where("deployment_id = ?", deploy.ID).Update("is_active", false)
			config.DB.Create(&models.DeploymentRelease{
				DeploymentID:  deploy.ID,
				ContainerID:   cleanID,
				ImageName:     deploy.ImageName,
				Branch:        deploy.Branch,
				CommitHash:    deploy.CommitHash,
				CommitMessage: deploy.CommitMessage,
				AuthorName:    deploy.AuthorName,
				AuthorAvatar:  deploy.AuthorAvatar,
				Status:        "success",
				IsActive:      true,
			})

			utils.CreateNotification(wsID, "Service Redeployed", fmt.Sprintf("Service '%s' was rebuilt and is live on %s", serviceName, cleanID), "success", serviceName)
			fmt.Println("Redeploy successful! Updated container ID to", cleanID)
		}
	}()
	c.JSON(http.StatusOK, gin.H{"message": "Pulling latest code and redeploying..."})
}

// PruneImages cleans dangling images and frees disk space
func PruneImages(c *gin.Context) {
	ctx := context.Background()
	reclaimedBytes, err := services.PruneUnusedImages(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prune images: " + err.Error()})
		return
	}

	reclaimedMB := float64(reclaimedBytes) / (1024 * 1024)
	c.JSON(http.StatusOK, gin.H{
		"message":               "Cleaned unused Docker images successfully",
		"space_reclaimed_mb":    fmt.Sprintf("%.2f", reclaimedMB),
		"space_reclaimed_bytes": reclaimedBytes,
	})
}

func GetContainerEnv(c *gin.Context) {
	id := c.Param("id")
	ctx := context.Background()
	envList, err := services.GetContainerEnv(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch environment variables: " + err.Error()})
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	var deploy models.Deployment
	if err := config.DB.Where("container_id LIKE ?", id+"%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found in database"})
		return
	}

	ctx := context.Background()
	newID, err := services.UpdateContainerEnv(ctx, deploy.ContainerID, req.EnvVars)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update environment variables: " + err.Error()})
		return
	}

	cleanID := newID
	if len(cleanID) > 12 {
		cleanID = cleanID[:12]
	}
	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"container_id": cleanID,
		"status":       "running",
		"last_error":   "",
	})

	wsID := deploy.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(deploy, id)
	utils.CreateNotification(wsID, "Environment Updated", fmt.Sprintf("Environment variables updated for service '%s'", serviceName), "info", serviceName)

	c.JSON(http.StatusOK, gin.H{"message": "Environment variables updated and service restarted successfully!", "new_id": cleanID})
}

func UpdateContainerDomain(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		CustomDomain     string `json:"custom_domain"`
		SSLEnabled       bool   `json:"ssl_enabled"`
		SSLForceRedirect bool   `json:"ssl_force_redirect"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	cleanDomain := strings.TrimSpace(req.CustomDomain)
	cleanDomain = strings.TrimPrefix(cleanDomain, "http://")
	cleanDomain = strings.TrimPrefix(cleanDomain, "https://")
	cleanDomain = strings.TrimSuffix(cleanDomain, "/")

	var deploy models.Deployment
	if err := config.DB.Where("container_id LIKE ?", id+"%").First(&deploy).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	sslStatus := "inactive"
	sslEnabled := req.SSLEnabled
	if cleanDomain != "" {
		if strings.HasSuffix(cleanDomain, ".localhost") {
			sslStatus = "local"
			sslEnabled = true
		} else if req.SSLEnabled {
			sslStatus = "active"
		}
	} else {
		sslEnabled = false
	}

	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"custom_domain":       cleanDomain,
		"ssl_enabled":         sslEnabled,
		"ssl_status":          sslStatus,
		"ssl_force_redirect":  req.SSLForceRedirect,
	})

	newID := deploy.ContainerID
	if deploy.ContainerID != "" {
		updatedID, err := services.UpdateContainerCustomDomain(context.Background(), deploy.ContainerID, cleanDomain, sslEnabled)
		if err == nil && updatedID != "" {
			newID = updatedID
			cleanID := updatedID
			if len(cleanID) > 12 {
				cleanID = cleanID[:12]
			}
			config.DB.Model(&deploy).Updates(map[string]interface{}{
				"container_id": cleanID,
				"status":       "running",
			})
		}
	}

	cleanID := newID
	if len(cleanID) > 12 {
		cleanID = cleanID[:12]
	}

	wsID := deploy.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}
	serviceName := getDeploymentDisplayName(deploy, id)
	if cleanDomain != "" {
		sslDesc := "with SSL disabled"
		if sslEnabled {
			sslDesc = "with Auto SSL (Let's Encrypt / TLS) enabled"
		}
		utils.CreateNotification(wsID, "Custom Domain Attached", fmt.Sprintf("Domain '%s' was attached to service '%s' %s", cleanDomain, serviceName, sslDesc), "info", serviceName)
	} else {
		utils.CreateNotification(wsID, "Custom Domain Removed", fmt.Sprintf("Custom domain removed from service '%s'", serviceName), "info", serviceName)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Custom domain & SSL updated successfully",
		"custom_domain":      cleanDomain,
		"ssl_enabled":        sslEnabled,
		"ssl_status":         sslStatus,
		"ssl_force_redirect": req.SSLForceRedirect,
		"new_id":             cleanID,
	})
}

// GetContainerReleases ดึงประวัติ Release ทั้งหมดของ Deployment นี้
func GetContainerReleases(c *gin.Context) {
	id := c.Param("id")
	deploy := findDeployment(id)
	if deploy.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	var releases []models.DeploymentRelease
	config.DB.Where("deployment_id = ?", deploy.ID).Order("created_at desc").Find(&releases)

	// ถ้ายังไม่มีประวัติ release เลย ให้สร้าง initial release จากข้อมูลปัจจุบันให้อัตโนมัติ
	if len(releases) == 0 {
		cleanHash := deploy.CommitHash
		if cleanHash == "" && deploy.ContainerID != "" {
			if len(deploy.ContainerID) >= 7 {
				cleanHash = deploy.ContainerID[:7]
			} else {
				cleanHash = deploy.ContainerID
			}
		}
		initial := models.DeploymentRelease{
			DeploymentID:  deploy.ID,
			ContainerID:   deploy.ContainerID,
			ImageName:     deploy.ImageName,
			Branch:        deploy.Branch,
			CommitHash:    cleanHash,
			CommitMessage: deploy.CommitMessage,
			AuthorName:    deploy.AuthorName,
			AuthorAvatar:  deploy.AuthorAvatar,
			Status:        "success",
			IsActive:      true,
			CreatedAt:     deploy.CreatedAt,
		}
		if initial.Branch == "" {
			initial.Branch = "main"
		}
		if initial.AuthorName == "" {
			initial.AuthorName = "Developer"
		}
		config.DB.Create(&initial)
		releases = append(releases, initial)
	}

	c.JSON(http.StatusOK, releases)
}

// RollbackContainer สลับ Container กลับไปรัน Release ก่อนหน้าทันที (Zero downtime / Zero build time)
func RollbackContainer(c *gin.Context) {
	id := c.Param("id")
	deploy := findDeployment(id)
	if deploy.ID == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Deployment not found"})
		return
	}

	var req struct {
		ReleaseID uint `json:"release_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify release_id to rollback"})
		return
	}

	var targetRelease models.DeploymentRelease
	if err := config.DB.Where("id = ? AND deployment_id = ?", req.ReleaseID, deploy.ID).First(&targetRelease).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Specified release not found"})
		return
	}

	ctx := context.Background()
	wsID := deploy.WorkspaceID
	if wsID == "" {
		wsID = utils.GetWorkspaceID(c)
	}

	newID, err := services.RollbackToImage(ctx, deploy.ContainerID, targetRelease.ImageName, wsID, deploy.CustomDomain, deploy.SSLEnabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Rollback failed: " + err.Error()})
		return
	}

	cleanID := newID
	if len(cleanID) > 12 {
		cleanID = cleanID[:12]
	}

	// Update main Deployment record
	config.DB.Model(&deploy).Updates(map[string]interface{}{
		"container_id":   cleanID,
		"status":         "running",
		"branch":         targetRelease.Branch,
		"commit_hash":    targetRelease.CommitHash,
		"commit_message": targetRelease.CommitMessage,
		"author_name":    targetRelease.AuthorName,
		"author_avatar":  targetRelease.AuthorAvatar,
		"last_error":     "",
		"updated_at":     time.Now(),
	})

	// Deactivate previous active release and activate target release
	config.DB.Model(&models.DeploymentRelease{}).Where("deployment_id = ?", deploy.ID).Update("is_active", false)
	config.DB.Model(&targetRelease).Updates(map[string]interface{}{
		"is_active":    true,
		"container_id": cleanID,
	})

	serviceName := getDeploymentDisplayName(deploy, id)
	commitTag := targetRelease.CommitHash
	if commitTag == "" {
		commitTag = targetRelease.Branch
	}
	utils.CreateNotification(wsID, "Deployment Rolled Back", fmt.Sprintf("Service '%s' was rolled back to release %s in 1 second", serviceName, commitTag), "warning", serviceName)

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("Rolled back to release successfully! Container restarted as %s", cleanID),
		"new_id":         cleanID,
		"active_release": targetRelease,
	})
}