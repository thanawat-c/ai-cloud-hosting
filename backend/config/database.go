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
	// สร้างตาราง deployments และ managed_databases ให้อัตโนมัติ
	err = database.AutoMigrate(&models.Deployment{}, &models.ManagedDatabase{})
	if err != nil {
		log.Fatal("❌ สร้างตารางอัตโนมัติล้มเหลว: ", err)
	}

	fmt.Println("✅ เชื่อมต่อ Database และสร้างตารางสำเร็จ!")
	DB = database
}
