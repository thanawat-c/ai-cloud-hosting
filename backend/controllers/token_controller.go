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

// GetTokens retrieves all API tokens for the workspace
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
		// Redact raw token from general list response
		tokens[i].Token = ""
	}

	c.JSON(http.StatusOK, tokens)
}

// CreateToken creates a new API Token for the workspace
func CreateToken(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a token name, e.g. 'CI/CD Pipeline'"})
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token name cannot be empty"})
		return
	}

	rawToken := generateAPIToken()

	newToken := models.APIToken{
		WorkspaceID: wsID,
		Name:        trimmedName,
		Token:       rawToken,
	}

	if err := config.DB.Create(&newToken).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token: " + err.Error()})
		return
	}

	utils.CreateNotification(wsID, "API Token Created", fmt.Sprintf("API token '%s' was generated", trimmedName), "info", trimmedName)

	c.JSON(http.StatusCreated, gin.H{
		"id":         newToken.ID,
		"name":       newToken.Name,
		"token":      rawToken, // Revealed only once upon creation
		"created_at": newToken.CreatedAt,
		"message":    "API Token generated successfully. Please copy and store it safely now.",
	})
}

// RevokeToken deletes/revokes an API Token
func RevokeToken(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	tokenID := c.Param("id")

	var token models.APIToken
	config.DB.Where("id = ? AND workspace_id = ?", tokenID, wsID).First(&token)
	tokenName := token.Name
	if tokenName == "" {
		tokenName = fmt.Sprintf("Token #%s", tokenID)
	}

	result := config.DB.Where("id = ? AND workspace_id = ?", tokenID, wsID).Delete(&models.APIToken{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found or unauthorized to delete"})
		return
	}

	utils.CreateNotification(wsID, "API Token Revoked", fmt.Sprintf("API token '%s' was revoked and invalidated", tokenName), "warning", tokenName)

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Token #%s revoked successfully", tokenID)})
}
