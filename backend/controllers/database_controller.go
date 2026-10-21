package controllers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetDatabases retrieves all databases for the current workspace
func GetDatabases(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	dbs, err := services.ListManagedDatabases(context.Background(), wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dbs)
}

// CreateDatabase creates a new managed database
func CreateDatabase(c *gin.Context) {
	var req models.CreateDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body. Please provide a database name."})
		return
	}

	wsID := utils.GetWorkspaceID(c)
	if req.WorkspaceID == "" {
		req.WorkspaceID = wsID
	}

	dbRecord, err := services.CreateManagedDatabase(context.Background(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Database created successfully!",
		"database": dbRecord,
	})
}

// StartDatabase starts a managed database
func StartDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if err := services.StartManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database started successfully"})
}

// StopDatabase stops a managed database
func StopDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if err := services.StopManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database stopped successfully"})
}

// DeleteDatabase deletes a managed database
func DeleteDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	if err := services.DeleteManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database deleted successfully"})
}

// QueryDatabase executes an SQL query on the database
func QueryDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var req struct {
		Query string `json:"query"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Query) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide an SQL query string"})
		return
	}

	output, err := services.ExecSQLInDatabase(context.Background(), uint(id), req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": output})
}

// GetDatabaseTables fetches the list of tables in the database
func GetDatabaseTables(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	tables, err := services.ListDatabaseTables(context.Background(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}

// BindDatabase binds a database to a target service container
func BindDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var req struct {
		ContainerID string `json:"container_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ContainerID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please specify the target container_id"})
		return
	}

	if err := services.BindDatabaseToContainer(context.Background(), uint(id), req.ContainerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err == nil {
		wsID := db.WorkspaceID
		if wsID == "" {
			wsID = "personal"
		}
		utils.CreateNotification(wsID, "Database Attached", fmt.Sprintf("Database '%s' was bound to container and service restarted", db.Name), "info", db.Name)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Database attached to service and container restarted successfully!"})
}

// BackupDatabase downloads a database dump .sql file
func BackupDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	if db.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database must be running to perform a backup"})
		return
	}

	sqlDump, err := services.BackupDatabaseSQL(context.Background(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Backup failed: " + err.Error()})
		return
	}

	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Backup", fmt.Sprintf("Exported SQL backup for database '%s'", db.Name), "info", db.Name)

	fileName := fmt.Sprintf("backup-%s-%s.sql", db.Name, time.Now().Format("20060102-150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	c.Header("Content-Type", "application/sql")
	c.String(http.StatusOK, sqlDump)
}

// RestoreDatabase receives a .sql file and restores data to the database
func RestoreDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Database not found"})
		return
	}

	if db.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database must be running to perform a restore"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid .sql backup file"})
		return
	}

	openedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
		return
	}
	defer openedFile.Close()

	contentBytes, err := io.ReadAll(openedFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file contents"})
		return
	}

	output, err := services.RestoreDatabaseSQL(context.Background(), db, string(contentBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Restore failed: " + err.Error()})
		return
	}

	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Restored", fmt.Sprintf("Database '%s' restored successfully from file '%s'", db.Name, file.Filename), "warning", db.Name)

	c.JSON(http.StatusOK, gin.H{
		"message": "Database restored successfully!",
		"output":  output,
	})
}

// CreateDatabaseSnapshot saves a database snapshot to host storage and creates a DB record
func CreateDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	_ = c.ShouldBindJSON(&req)

	wsID := utils.GetWorkspaceID(c)
	snapshot, err := services.CreateDatabaseSnapshot(context.Background(), uint(id), req.Notes, wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Snapshot created successfully!",
		"snapshot": snapshot,
	})
}

// GetDatabaseSnapshots retrieves all snapshots for a given database
func GetDatabaseSnapshots(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	snapshots, err := services.ListDatabaseSnapshots(context.Background(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, snapshots)
}

// RestoreDatabaseSnapshot restores database data from a specific snapshot ID
func RestoreDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot ID"})
		return
	}

	output, err := services.RestoreDatabaseSnapshot(context.Background(), uint(id), uint(snapID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Database restored from snapshot successfully!",
		"output":  output,
	})
}

// DownloadDatabaseSnapshot downloads the .sql file for a snapshot
func DownloadDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot ID"})
		return
	}

	filePath, fileName, err := services.GetSnapshotFilePath(uint(id), uint(snapID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	c.Header("Content-Type", "application/sql")
	c.File(filePath)
}

// DeleteDatabaseSnapshot deletes a snapshot
func DeleteDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid database ID"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot ID"})
		return
	}

	if err := services.DeleteDatabaseSnapshot(context.Background(), uint(id), uint(snapID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Snapshot deleted successfully"})
}
