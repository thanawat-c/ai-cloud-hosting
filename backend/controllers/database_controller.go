package controllers

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

// GetDatabases ดึงรายการ Database ทั้งหมด
func GetDatabases(c *gin.Context) {
	dbs, err := services.ListManagedDatabases(context.Background())
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

	c.JSON(http.StatusOK, gin.H{"message": "ผูก Database เข้ากับเซิร์ฟเวอร์และรีสตาร์ตสำเร็จเรียบร้อยแล้ว!"})
}

