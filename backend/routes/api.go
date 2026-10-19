package routes

import (
	"ai-cloud-api/controllers"

	"github.com/gin-gonic/gin"
)

// SetupRoutes กำหนด Routing ทั้งหมดของ API
func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.POST("/test-deploy", controllers.TestDeploy)
		api.POST("/inspect-repo", controllers.InspectRepo)
		api.GET("/containers", controllers.GetContainers)
		api.POST("/containers/:id/stop", controllers.StopContainer)
		api.POST("/containers/:id/start", controllers.StartContainer)
		api.DELETE("/containers/:id", controllers.DeleteContainer)
		api.POST("/containers/:id/delete", controllers.DeleteContainer)
		api.GET("/containers/:id/logs", controllers.GetContainerLogs)
		api.GET("/containers/:id/stats", controllers.GetContainerStats)
		api.POST("/containers/:id/redeploy", controllers.RedeployContainer)
		api.GET("/containers/:id/env", controllers.GetContainerEnv)
		api.POST("/containers/:id/env", controllers.UpdateContainerEnv)
		api.POST("/containers/:id/domain", controllers.UpdateContainerDomain)
		api.POST("/system/prune", controllers.PruneImages)

		// Managed Databases
		api.GET("/databases", controllers.GetDatabases)
		api.POST("/databases", controllers.CreateDatabase)
		api.POST("/databases/:id/start", controllers.StartDatabase)
		api.POST("/databases/:id/stop", controllers.StopDatabase)
		api.DELETE("/databases/:id", controllers.DeleteDatabase)
		api.POST("/databases/:id/query", controllers.QueryDatabase)
		api.GET("/databases/:id/tables", controllers.GetDatabaseTables)
		api.POST("/databases/:id/bind", controllers.BindDatabase)
		api.GET("/databases/:id/backup", controllers.BackupDatabase)
		api.POST("/databases/:id/restore", controllers.RestoreDatabase)

		// Workspaces (Multi-Tenancy)
		api.GET("/workspaces", controllers.GetWorkspaces)
		api.POST("/workspaces", controllers.CreateWorkspace)

		// Notifications (System Alerts & Audit Log)
		api.GET("/notifications", controllers.GetNotifications)
		api.POST("/notifications/read-all", controllers.MarkAllNotificationsRead)
		api.DELETE("/notifications", controllers.ClearNotifications)

		// API Tokens (User Token Management)
		api.GET("/tokens", controllers.GetTokens)
		api.POST("/tokens", controllers.CreateToken)
		api.DELETE("/tokens/:id", controllers.RevokeToken)

		// GitHub Webhooks (Auto-Deploy on Push)
		api.POST("/webhooks/deploy/:id", controllers.HandleDeploymentWebhook)
		api.POST("/webhooks/github", controllers.HandleGlobalGitHubWebhook)
	}
}
