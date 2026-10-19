package main

import (
	"fmt"
	"ai-cloud-api/routes"
	"ai-cloud-api/config"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"log"
	"os"
	"os/exec"
)

func main() {
	err := godotenv.Overload()
	if err != nil {
		log.Println("ไม่พบไฟล์ .env (จะลองอ่านจาก System OS แทน)")
	}

	// เชื่อมต่อ Database
	config.ConnectDatabase()

	// รัน sync_traefik.sh เป็น background process
	go func() {
		_ = exec.Command("pkill", "-f", "sync_traefik.sh").Run()
		for {
			cmd := exec.Command("bash", "sync_traefik.sh")
			if err := cmd.Run(); err != nil {
				fmt.Println("Warning: sync_traefik.sh exited with error:", err)
			}
			time.Sleep(3 * time.Second)
		}
	}()

	r := gin.Default()

	corsOrigin := "http://localhost:5173"
	if envOrigin := os.Getenv("CORS_ALLOWED_ORIGIN"); envOrigin != "" {
		corsOrigin = envOrigin
	}

	// เปิดใช้งาน CORS ให้ React (Port 5173) สามารถยิง API เข้ามาได้
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if corsOrigin == "*" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" || origin == corsOrigin {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", corsOrigin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Workspace-Id, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// เรียกใช้งาน Routes
	routes.SetupRoutes(r)

	fmt.Println("🚀 Backend เริ่มทำงานที่พอร์ต :8080")
	r.Run(":8080")
}