package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/services"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register creates a new user account and returns a JWT token
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid name, email address, and password (at least 6 characters)"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	cleanName := strings.TrimSpace(req.Name)

	// Check if email already registered
	var existing models.User
	if err := config.DB.Where("email = ?", cleanEmail).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email address already exists"})
		return
	}

	// Hash password
	hashedPassword, err := services.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt password"})
		return
	}

	newUser := models.User{
		Email:        cleanEmail,
		PasswordHash: hashedPassword,
		Name:         cleanName,
		Role:         "developer",
		AvatarURL:    fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", cleanEmail),
	}

	if err := config.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user account: " + err.Error()})
		return
	}

	// Generate JWT
	token, err := services.GenerateJWT(&newUser)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	utils.CreateNotification("personal", "New User Registered", fmt.Sprintf("User %s (%s) registered successfully", cleanName, cleanEmail), "info", cleanName)

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user": gin.H{
			"id":         newUser.ID,
			"name":       newUser.Name,
			"email":      newUser.Email,
			"role":       newUser.Role,
			"avatar_url": newUser.AvatarURL,
			"created_at": newUser.CreatedAt,
		},
		"message": "Account created successfully",
	})
}

// Login authenticates a user and returns a JWT token
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid email and password"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := config.DB.Where("email = ?", cleanEmail).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !services.CheckPasswordHash(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := services.GenerateJWT(&user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate authentication token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         user.ID,
			"name":       user.Name,
			"email":      user.Email,
			"role":       user.Role,
			"avatar_url": user.AvatarURL,
			"created_at": user.CreatedAt,
		},
		"message": "Signed in successfully",
	})
}

// GetCurrentUser returns the profile of the authenticated user
func GetCurrentUser(c *gin.Context) {
	// Look for user claims set by auth middleware
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var user models.User
	if err := config.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User account not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         user.ID,
		"name":       user.Name,
		"email":      user.Email,
		"role":       user.Role,
		"avatar_url": user.AvatarURL,
		"created_at": user.CreatedAt,
	})
}

// Logout confirms user sign-out
func Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
