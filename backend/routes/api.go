package routes

import (
	"ai-cloud-api/controllers"
	"ai-cloud-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetupRoutes กำหนด Routing ทั้งหมดของ API
func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	api.Use(middleware.ExtractUserContext())
	{
		// Authentication (User Accounts)
		auth := api.Group("/auth")
		{
			auth.POST("/register", controllers.Register)
			auth.POST("/login", controllers.Login)
			auth.POST("/logout", controllers.Logout)
			auth.GET("/me", middleware.RequireAuth(), controllers.GetCurrentUser)
		}

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
		api.GET("/containers/:id/releases", controllers.GetContainerReleases)
		api.POST("/containers/:id/rollback", controllers.RollbackContainer)
		api.GET("/containers/:id/settings", controllers.GetContainerSettings)
		api.POST("/containers/:id/settings", controllers.UpdateContainerSettings)
		// System Host Health & Maintenance
		api.GET("/system/health", controllers.GetSystemHealth)
		api.POST("/system/prune", controllers.PruneDockerSystem)

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
		api.GET("/databases/:id/snapshots", controllers.GetDatabaseSnapshots)
		api.POST("/databases/:id/snapshots", controllers.CreateDatabaseSnapshot)
		api.POST("/databases/:id/snapshots/:snapshot_id/restore", controllers.RestoreDatabaseSnapshot)
		api.GET("/databases/:id/snapshots/:snapshot_id/download", controllers.DownloadDatabaseSnapshot)
		api.DELETE("/databases/:id/snapshots/:snapshot_id", controllers.DeleteDatabaseSnapshot)

		// Persistent Storage & Volumes
		api.GET("/volumes", controllers.GetVolumes)
		api.POST("/volumes", controllers.CreateVolume)
		api.POST("/volumes/:id/attach", controllers.AttachVolume)
		api.POST("/volumes/:id/detach", controllers.DetachVolume)
		api.DELETE("/volumes/:id", controllers.DeleteVolume)

		// Workspaces & Team Members
		api.GET("/workspaces", controllers.GetWorkspaces)
		api.POST("/workspaces", controllers.CreateWorkspace)
		api.GET("/workspaces/members", controllers.GetWorkspaceMembers)
		api.POST("/workspaces/members/invite", controllers.InviteWorkspaceMember)
		api.PATCH("/workspaces/members/:id/role", controllers.UpdateWorkspaceMemberRole)
		api.DELETE("/workspaces/members/:id", controllers.RemoveWorkspaceMember)

		// Notifications & Audit Trail
		api.GET("/notifications", controllers.GetNotifications)
		api.POST("/notifications/read-all", controllers.MarkAllNotificationsRead)
		api.DELETE("/notifications", controllers.ClearNotifications)
		api.GET("/audit-logs", controllers.GetAuditLogs)

		// API Tokens (User Token Management)
		api.GET("/tokens", controllers.GetTokens)
		api.POST("/tokens", controllers.CreateToken)
		api.DELETE("/tokens/:id", controllers.RevokeToken)

		// GitHub Webhooks (Auto-Deploy on Push)
		api.POST("/webhooks/deploy/:id", controllers.HandleDeploymentWebhook)
		api.POST("/webhooks/github", controllers.HandleGlobalGitHubWebhook)
	}
}
