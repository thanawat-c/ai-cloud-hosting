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
	}
}
