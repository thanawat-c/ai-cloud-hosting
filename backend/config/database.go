package config

import (
	"fmt"
	"log"
	"os"

	"ai-cloud-api/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ตัวแปร DB เอาไว้ให้ไฟล์อื่น (เช่น Controller) ดึงไปใช้งาน
var DB *gorm.DB

func ConnectDatabase() {
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		log.Fatal("❌ หาตัวแปร DB_URL ใน .env ไม่เจอครับ!")
	}

	// เชื่อมต่อ PostgreSQL
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("❌ เชื่อมต่อ Database ไม่สำเร็จ: ", err)
	}

	// ฟีเจอร์เด็ดของ GORM: Auto Migrate
	// สร้างตาราง workspaces, deployments และ managed_databases ให้อัตโนมัติ
	err = database.AutoMigrate(&models.Workspace{}, &models.Deployment{}, &models.ManagedDatabase{})
	if err != nil {
		log.Fatal("❌ สร้างตารางอัตโนมัติล้มเหลว: ", err)
	}

	// Seed Workspaces เริ่มต้น (Personal และ Engineering Team)
	seedWorkspaces(database)

	// Backfill ข้อมูลเดิมที่ยังไม่มี workspace_id ให้เข้า 'personal' ทันที ป้องกันข้อมูลหาย
	database.Model(&models.Deployment{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")
	database.Model(&models.ManagedDatabase{}).Where("workspace_id = '' OR workspace_id IS NULL").Update("workspace_id", "personal")

	fmt.Println("✅ เชื่อมต่อ Database และสร้างตารางสำเร็จ!")
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
