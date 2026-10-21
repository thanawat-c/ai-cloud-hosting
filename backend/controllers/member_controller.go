package controllers

import (
	"fmt"
	"net/http"
	"strings"

	"ai-cloud-api/config"
	"ai-cloud-api/models"
	"ai-cloud-api/utils"

	"github.com/gin-gonic/gin"
)

// GetWorkspaceMembers returns all members belonging to the current active workspace
func GetWorkspaceMembers(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var members []models.WorkspaceMember
	config.DB.Where("workspace_id = ?", wsID).Order("joined_at asc").Find(&members)

	// If workspace has no members recorded yet, automatically register workspace owner
	if len(members) == 0 {
		userEmail := c.GetString("user_email")
		userName := c.GetString("user_name")
		if userEmail == "" {
			userEmail = "owner@aicloud.local"
			userName = "Workspace Owner"
		}

		cleanEmail := strings.ToLower(strings.TrimSpace(userEmail))
		avatar := fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", cleanEmail)
		var existingUser models.User
		if err := config.DB.Where("email = ?", cleanEmail).First(&existingUser).Error; err == nil && existingUser.AvatarURL != "" {
			avatar = existingUser.AvatarURL
		}
		initialOwner := models.WorkspaceMember{
			WorkspaceID: wsID,
			Email:       strings.ToLower(userEmail),
			Name:        userName,
			Role:        "owner",
			AvatarURL:   avatar,
			InvitedBy:   "System",
		}
		config.DB.Create(&initialOwner)
		members = append(members, initialOwner)
	}

	c.JSON(http.StatusOK, members)
}

// InviteWorkspaceMember invites a new user into the active workspace
func InviteWorkspaceMember(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)

	var req models.InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide a valid email address"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	role := strings.ToLower(strings.TrimSpace(req.Role))
	if role == "" {
		role = "member"
	}

	// Validate role
	allowedRoles := map[string]bool{"owner": true, "admin": true, "member": true, "viewer": true}
	if !allowedRoles[role] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be owner, admin, member, or viewer"})
		return
	}

	// Check if already a member
	var existing models.WorkspaceMember
	if err := config.DB.Where("workspace_id = ? AND email = ?", wsID, cleanEmail).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User with this email is already a member of this workspace"})
		return
	}

	// Check if user exists in User table to borrow avatar and display name
	var user models.User
	name := strings.TrimSpace(req.Name)
	avatar := fmt.Sprintf("https://api.dicebear.com/7.x/identicon/svg?seed=%s", cleanEmail)

	if err := config.DB.Where("email = ?", cleanEmail).First(&user).Error; err == nil {
		if name == "" {
			name = user.Name
		}
		if user.AvatarURL != "" {
			avatar = user.AvatarURL
		}
	}

	if name == "" {
		// Use username part from email
		parts := strings.Split(cleanEmail, "@")
		name = strings.Title(parts[0])
	}

	inviterName := c.GetString("user_name")
	if inviterName == "" {
		inviterName = "Admin"
	}

	newMember := models.WorkspaceMember{
		WorkspaceID: wsID,
		Email:       cleanEmail,
		Name:        name,
		Role:        role,
		AvatarURL:   avatar,
		InvitedBy:   inviterName,
	}

	if err := config.DB.Create(&newMember).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add workspace member: " + err.Error()})
		return
	}

	utils.CreateNotification(wsID, "Member Joined Workspace", fmt.Sprintf("%s (%s) was added as %s", name, cleanEmail, strings.ToUpper(role)), "success", cleanEmail)
	utils.LogActivity(c, wsID, "member.invite", "member", cleanEmail, name, fmt.Sprintf("Invited as %s", strings.ToUpper(role)))

	c.JSON(http.StatusCreated, gin.H{
		"message": "Member added to workspace successfully",
		"member":  newMember,
	})
}

// UpdateWorkspaceMemberRole updates a member's role
func UpdateWorkspaceMemberRole(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	memberID := c.Param("id")

	var member models.WorkspaceMember
	if err := config.DB.Where("id = ? AND workspace_id = ?", memberID, wsID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in this workspace"})
		return
	}

	var req models.UpdateMemberRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Role is required"})
		return
	}

	newRole := strings.ToLower(strings.TrimSpace(req.Role))
	allowedRoles := map[string]bool{"owner": true, "admin": true, "member": true, "viewer": true}
	if !allowedRoles[newRole] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role"})
		return
	}

	// Prevent demoting the only owner
	if member.Role == "owner" && newRole != "owner" {
		var ownerCount int64
		config.DB.Model(&models.WorkspaceMember{}).Where("workspace_id = ? AND role = 'owner'", wsID).Count(&ownerCount)
		if ownerCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change the role of the only workspace owner"})
			return
		}
	}

	config.DB.Model(&member).Update("role", newRole)
	member.Role = newRole

	utils.CreateNotification(wsID, "Member Role Updated", fmt.Sprintf("Updated %s's role to %s", member.Name, strings.ToUpper(newRole)), "info", member.Email)

	c.JSON(http.StatusOK, gin.H{
		"message": "Role updated successfully",
		"member":  member,
	})
}

// RemoveWorkspaceMember removes a member from the workspace
func RemoveWorkspaceMember(c *gin.Context) {
	wsID := utils.GetWorkspaceID(c)
	memberID := c.Param("id")

	var member models.WorkspaceMember
	if err := config.DB.Where("id = ? AND workspace_id = ?", memberID, wsID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found"})
		return
	}

	if member.Role == "owner" {
		var ownerCount int64
		config.DB.Model(&models.WorkspaceMember{}).Where("workspace_id = ? AND role = 'owner'", wsID).Count(&ownerCount)
		if ownerCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove the primary workspace owner"})
			return
		}
	}

	config.DB.Delete(&member)

	utils.CreateNotification(wsID, "Member Removed", fmt.Sprintf("%s was removed from workspace", member.Name), "warning", member.Email)

	c.JSON(http.StatusOK, gin.H{"message": "Member removed from workspace successfully"})
}
