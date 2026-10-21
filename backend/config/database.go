package config

import (
	"fmt"
	"log"
	"os"

	"ai-cloud-api/models"
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

	// Connect to PostgreSQL
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ Failed to connect to Database: ", err)
	}

	// GORM Auto Migrate tables
	err = database.AutoMigrate(
		&models.Workspace{}, 
		&models.Deployment{}, 
		&models.ManagedDatabase{},
		&models.Notification{},
		&models.APIToken{},
		&models.DatabaseSnapshot{},
		&models.DeploymentRelease{},
	)
	if err != nil {
		log.Fatal("❌ Auto-migration failed: ", err)
	}

	// Seed default workspaces
	seedWorkspaces(database)

	// Backfill existing records with empty workspace_id to 'personal'
	database.Model(&models.Deployment{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")
	database.Model(&models.ManagedDatabase{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")

	fmt.Println("✅ Database connected and migrated successfully!")
	DB = database
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
