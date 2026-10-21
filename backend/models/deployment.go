package models

import (
	"time"
)

// Deployment represents a deployed application service instance.
type Deployment struct {
	ID               uint   `gorm:"primaryKey"`                                                    // Primary key
	WorkspaceID      string `gorm:"type:varchar(50);default:'personal';index" json:"workspace_id"` // Scoped workspace ID
	RepoURL          string `gorm:"not null"`                                                      // Git repository URL
	GitToken         string `gorm:"type:text"`                                                     // Git access token for private repositories
	ImageName        string // Docker image tag
	ContainerID      string // Docker container ID
	DomainName       string // Generated domain name
	Status           string `gorm:"default:'running'"`                                     // Status: running, stopped, failed
	ForceAI          bool   `gorm:"default:false"`                                         // Force AI Dockerfile generation
	WebhookSecret    string `json:"webhook_secret"`                                        // GitHub webhook secret
	AutoDeploy       bool   `gorm:"default:true" json:"auto_deploy"`                       // Trigger deploy on push
	Branch           string `gorm:"type:varchar(100);default:'main'" json:"branch"`        // Active branch
	CommitHash       string `gorm:"type:varchar(40)" json:"commit_hash"`                   // Short commit hash
	CommitMessage    string `gorm:"type:text" json:"commit_message"`                       // Latest commit message
	AuthorName       string `gorm:"type:varchar(100)" json:"author_name"`                  // Commit author or deployer name
	AuthorAvatar     string `gorm:"type:varchar(255)" json:"author_avatar"`                // Deployer avatar URL
	CustomDomain     string `gorm:"type:varchar(255)" json:"custom_domain"`                // Custom domain name
	SSLEnabled       bool   `gorm:"default:false" json:"ssl_enabled"`                      // SSL/HTTPS status
	SSLStatus        string `gorm:"type:varchar(50);default:'inactive'" json:"ssl_status"` // inactive, local, active
	SSLForceRedirect bool   `gorm:"default:true" json:"ssl_force_redirect"`                // Redirect HTTP to HTTPS
	LastError        string `gorm:"type:text"`                                             // Error message if deployment fails

	// Build & Project Configuration (Monorepo, Custom Scripts)
	RootDir     string `gorm:"type:varchar(255);default:''" json:"root_dir"`      // Monorepo root directory
	BuildCmd    string `gorm:"type:text;default:''" json:"build_cmd"`             // Custom build command
	InstallCmd  string `gorm:"type:text;default:''" json:"install_cmd"`           // Custom install command
	StartCmd    string `gorm:"type:text;default:''" json:"start_cmd"`             // Custom start command
	OutputDir   string `gorm:"type:varchar(255);default:''" json:"output_dir"`    // Build output directory
	NodeVersion string `gorm:"type:varchar(20);default:'20'" json:"node_version"` // Node runtime version

	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

type DeploymentRelease struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	DeploymentID  uint      `json:"deployment_id" gorm:"index;not null"`
	ContainerID   string    `json:"container_id" gorm:"type:varchar(64)"`
	ImageName     string    `json:"image_name" gorm:"not null"`
	Branch        string    `json:"branch" gorm:"type:varchar(100)"`
	CommitHash    string    `json:"commit_hash" gorm:"type:varchar(40)"`
	CommitMessage string    `json:"commit_message" gorm:"type:text"`
	AuthorName    string    `json:"author_name" gorm:"type:varchar(100)"`
	AuthorAvatar  string    `json:"author_avatar" gorm:"type:varchar(255)"`
	EnvVars       string    `json:"env_vars" gorm:"type:text"`
	Status        string    `json:"status" gorm:"default:'success'"`
	IsActive      bool      `json:"is_active" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at" gorm:"autoCreateTime"`
}
