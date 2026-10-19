package controllers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

func generateAPIToken() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return "ach_live_" + hex.EncodeToString(b)
}

// GetTokens ดึงรายการ API Tokens ทั้งหมดของ Workspace
func GetTokens(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var tokens []models.APIToken
	config.DB.Where("workspace_id = ?", wsID).Order("created_at desc").Find(&tokens)

	for i := range tokens {
		t := tokens[i].Token
		if len(t) > 16 {
			tokens[i].MaskedToken = t[:9] + "••••••••••••" + t[len(t)-4:]
		} else {
			tokens[i].MaskedToken = "••••••••••••"
		}
		// ปิดไม่ให้ส่ง raw token ออกไปในการดึงรายการทั่วไป
		tokens[i].Token = ""
	}

	c.JSON(http.StatusOK, tokens)
}

// CreateToken สร้าง API Token ใหม่สำหรับ Workspace
func CreateToken(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุชื่อ Token เช่น 'CI/CD Pipeline'"})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ชื่อ Token ห้ามเว้นว่าง"})
		return
	}

	rawToken := generateAPIToken()

	newToken := models.APIToken{
		WorkspaceID: wsID,
		Name:        trimmedName,
		Token:       rawToken,
	}

	if err := config.DB.Create(&newToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "สร้าง Token ล้มเหลว: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":         newToken.ID,
		"name":       newToken.Name,
		"token":      rawToken, // ส่ง raw token ให้เห็นครั้งนี้ครั้งเดียว
		"created_at": newToken.CreatedAt,
		"message":    "สร้าง API Token เรียบร้อยแล้ว กรุณาคัดลอกเก็บไว้ทันที",
	})
}

// RevokeToken ลบ/ยกเลิก Token
func RevokeToken(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	tokenID := c.Param("id")

	result := config.DB.Where("id = ? AND workspace_id = ?", tokenID, wsID).Delete(&models.APIToken{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบ Token หรือไม่มีสิทธิ์ลบ"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("ยกเลิก Token #%s สำเร็จ", tokenID)})
}
