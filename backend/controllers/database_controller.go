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

// GetDatabases ดึงรายการ Database ทั้งหมด ตาม Workspace
func GetDatabases(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	dbs, err := services.ListManagedDatabases(context.Background(), wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dbs)
}

// CreateDatabase สั่งสร้าง Database ใหม่
func CreateDatabase(c *gin.Context) {
	var req models.CreateDatabaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง กรุณาระบุชื่อ Database"})
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
		"message":  "สร้างฐานข้อมูลเรียบร้อยแล้ว!",
		"database": dbRecord,
	})
}

// StartDatabase สั่งเปิด Database
func StartDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	if err := services.StartManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "เริ่มการทำงานของ Database สำเร็จ"})
}

// StopDatabase สั่งหยุด Database
func StopDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	if err := services.StopManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "หยุดการทำงานของ Database สำเร็จ"})
}

// DeleteDatabase สั่งลบ Database
func DeleteDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	if err := services.DeleteManagedDatabase(context.Background(), uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ลบ Database เรียบร้อยแล้ว"})
}

// QueryDatabase รันคำสั่ง SQL ใน Database
func QueryDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	var req struct {
		Query string `json:"query"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Query) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุคำสั่ง SQL"})
		return
	}

	output, err := services.ExecSQLInDatabase(context.Background(), uint(id), req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"result": output})
}

// GetDatabaseTables ดึงรายชื่อ Table
func GetDatabaseTables(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	tables, err := services.ListDatabaseTables(context.Background(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tables": tables})
}

// BindDatabase ผูก Database เข้ากับคอนเทนเนอร์เป้าหมาย
func BindDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	var req struct {
		ContainerID string `json:"container_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.ContainerID) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุ container_id ที่ต้องการผูก"})
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

	c.JSON(http.StatusOK, gin.H{"message": "ผูก Database เข้ากับเซิร์ฟเวอร์และรีสตาร์ตสำเร็จเรียบร้อยแล้ว!"})
}

// BackupDatabase ดาวน์โหลดไฟล์ dump .sql
func BackupDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบ Database"})
		return
	}

	if db.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database ต้องอยู่ในสถานะ Running ก่อนทำ Backup"})
		return
	}

	sqlDump, err := services.BackupDatabaseSQL(context.Background(), db)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ทำ Backup ล้มเหลว: " + err.Error()})
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

// RestoreDatabase รับไฟล์ .sql แล้วกู้คืนข้อมูลเข้า Database
func RestoreDatabase(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	var db models.ManagedDatabase
	if err := config.DB.First(&db, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบ Database"})
		return
	}

	if db.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database ต้องอยู่ในสถานะ Running ก่อนทำ Restore"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาแนบไฟล์ .sql"})
		return
	}

	openedFile, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เปิดไฟล์ไม่สำเร็จ"})
		return
	}
	defer openedFile.Close()

	contentBytes, err := io.ReadAll(openedFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "อ่านเนื้อหาไฟล์ไม่สำเร็จ"})
		return
	}

	output, err := services.RestoreDatabaseSQL(context.Background(), db, string(contentBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Restore ล้มเหลว: " + err.Error()})
		return
	}

	wsID := db.WorkspaceID
	if wsID == "" {
		wsID = "personal"
	}
	utils.CreateNotification(wsID, "Database Restored", fmt.Sprintf("Database '%s' restored successfully from file '%s'", db.Name, file.Filename), "warning", db.Name)

	c.JSON(http.StatusOK, gin.H{
		"message": "กู้คืนข้อมูล (Restore) สำเร็จเรียบร้อยแล้ว!",
		"output":  output,
	})
}

// CreateDatabaseSnapshot บันทึก Snapshot ลง Host Disk และสร้าง Record
func CreateDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
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
		"message":  "สร้าง Snapshot สำเร็จเรียบร้อยแล้ว!",
		"snapshot": snapshot,
	})
}

// GetDatabaseSnapshots ดึงประวัติ Snapshot ทั้งหมดของ Database
func GetDatabaseSnapshots(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID ไม่ถูกต้อง"})
		return
	}

	snapshots, err := services.ListDatabaseSnapshots(context.Background(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, snapshots)
}

// RestoreDatabaseSnapshot กู้คืนข้อมูลจาก Snapshot ID ที่ระบุ
func RestoreDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database ID ไม่ถูกต้อง"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Snapshot ID ไม่ถูกต้อง"})
		return
	}

	output, err := services.RestoreDatabaseSnapshot(context.Background(), uint(id), uint(snapID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "กู้คืนข้อมูลจาก Snapshot สำเร็จเรียบร้อยแล้ว!",
		"output":  output,
	})
}

// DownloadDatabaseSnapshot ดาวน์โหลดไฟล์ .sql จาก Snapshot
func DownloadDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database ID ไม่ถูกต้อง"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Snapshot ID ไม่ถูกต้อง"})
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

// DeleteDatabaseSnapshot ลบ Snapshot
func DeleteDatabaseSnapshot(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Database ID ไม่ถูกต้อง"})
		return
	}

	snapParam := c.Param("snapshot_id")
	snapID, err := strconv.ParseUint(snapParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Snapshot ID ไม่ถูกต้อง"})
		return
	}

	if err := services.DeleteDatabaseSnapshot(context.Background(), uint(id), uint(snapID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ลบ Snapshot สำเร็จเรียบร้อยแล้ว"})
}


