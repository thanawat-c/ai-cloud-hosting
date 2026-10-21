package middleware

import (
	"net/http"
	"strings"
	"time"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"

	"github.com/gin-gonic/gin"
)

// ExtractUserContext parses Bearer token (JWT or API Token) if present and injects user/workspace context
func ExtractUserContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			tokenStr := strings.TrimSpace(authHeader[7:])
			if tokenStr != "" {
				// Case A: API Token (CLI / CI/CD)
				if strings.HasPrefix(tokenStr, "ach_live_") {
					var apiToken models.APIToken
					if err := config.DB.Where("token = ?", tokenStr).First(&apiToken).Error; err == nil {
						now := time.Now()
						config.DB.Model(&apiToken).Update("last_used_at", &now)
						c.Set("api_token_id", apiToken.ID)
						c.Set("workspace_id", apiToken.WorkspaceID)
						c.Set("is_authenticated", true)
						c.Next()
						return
					}
				}

				// Case B: User JWT Token
				claims, err := services.ValidateJWT(tokenStr)
				if err == nil && claims != nil {
					c.Set("user_id", claims.UserID)
					c.Set("user_email", claims.Email)
					c.Set("user_name", claims.Name)
					c.Set("user_role", claims.Role)
					c.Set("is_authenticated", true)
					c.Next()
					return
				}
			}
		}

		c.Next()
	}
}

// RequireAuth ensures that the request has a valid authenticated JWT user
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required. Please sign in."})
			return
		}

		tokenStr := strings.TrimSpace(authHeader[7:])
		claims, err := services.ValidateJWT(tokenStr)
		if err != nil || claims == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Session expired or invalid token. Please sign in again."})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_name", claims.Name)
		c.Set("user_role", claims.Role)
		c.Set("is_authenticated", true)
		c.Next()
	}
}
