package controllers

import (
	"context"
	"net/http"

	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

// GetContainerLogs returns console build/runtime logs for a container
func GetContainerLogs(c *gin.Context) {
	id := c.Param("id")
	logs, err := services.GetContainerLogs(context.Background(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch logs: " + err.Error()})
		return
	}
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.String(http.StatusOK, logs)
}

// GetContainerStats returns real-time CPU, Memory, and Network I/O metrics
func GetContainerStats(c *gin.Context) {
	id := c.Param("id")
	stats, err := services.GetContainerStats(context.Background(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read stats: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}
