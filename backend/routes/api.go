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
		api.GET("/containers/:id/logs", controllers.GetContainerLogs)
		api.GET("/containers/:id/stats", controllers.GetContainerStats)
		api.POST("/containers/:id/redeploy", controllers.RedeployContainer)
		api.GET("/containers/:id/env", controllers.GetContainerEnv)
		api.POST("/containers/:id/env", controllers.UpdateContainerEnv)
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
	}
}
