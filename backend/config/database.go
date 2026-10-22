package config

import (
	"fmt"
	"log"
	"os"

	"ai-cloud-api/models"
	"strings"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB instance for controllers and services
var DB *gorm.DB

func ConnectDatabase() {
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		log.Fatal("❌ DB_URL environment variable is missing in .env or environment!")
	}

	// Connect to PostgreSQL (configured with PreferSimpleProtocol for Supabase / PgBouncer pooler compatibility)
	database, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		PrepareStmt: false,
	})
	if err != nil {
		log.Fatal("❌ Failed to connect to Database: ", err)
	}

	// GORM Auto Migrate tables
	err = database.AutoMigrate(
		&models.User{},
		&models.Workspace{},
		&models.Deployment{},
		&models.ManagedDatabase{},
		&models.Notification{},
		&models.APIToken{},
		&models.DatabaseSnapshot{},
		&models.DeploymentRelease{},
		&models.WorkspaceMember{},
		&models.Volume{},
		&models.AuditLog{},
		&models.WebhookAlert{},
	)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			fmt.Println("⚠️ Tables already exist, continuing startup:", err)
		} else {
			log.Fatal("❌ Auto-migration failed: ", err)
		}
	}

	// Seed default workspaces and admin user
	seedWorkspaces(database)
	seedAdminUser(database)

	// Backfill existing records with empty workspace_id to 'personal'
	database.Model(&models.Deployment{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")
	database.Model(&models.ManagedDatabase{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")

	fmt.Println("✅ Database connected and migrated successfully!")
	DB = database
}

func seedAdminUser(db *gorm.DB) {
	var count int64
	db.Model(&models.User{}).Count(&count)
	if count == 0 {
		hashed, err := bcrypt.GenerateFromPassword([]byte("admin1234"), bcrypt.DefaultCost)
		if err == nil {
			admin := models.User{
				Email:        "admin@aicloud.dev",
				PasswordHash: string(hashed),
				Name:         "Admin User",
				Role:         "admin",
				AvatarURL:    "https://api.dicebear.com/7.x/identicon/svg?seed=admin@aicloud.dev",
			}
			db.Create(&admin)
			fmt.Println("🔑 Default Admin user seeded: admin@aicloud.dev (password: admin1234)")
		}
	}
}

func seedWorkspaces(db *gorm.DB) {
	defaultWorkspaces := []models.Workspace{
		{
			ID:          "personal",
			Name:        "Personal (Pro)",
			Slug:        "personal",
			Type:        "personal",
			Plan:        "Pro",
			Color:       "emerald",
			Description: "Your personal development workspace",
		},
		{
			ID:          "engineering",
			Name:        "Engineering Team",
			Slug:        "engineering",
			Type:        "team",
			Plan:        "Pro",
			Color:       "purple",
			Description: "Shared team workspace for engineering & production services",
		},
	}

	for _, ws := range defaultWorkspaces {
		var existing models.Workspace
		if err := db.Where("id = ?", ws.ID).First(&existing).Error; err != nil {
			db.Create(&ws)
		}
	}
}
