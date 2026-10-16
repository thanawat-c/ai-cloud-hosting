package models

import (
	"time"
)

// Deployment คือโครงสร้างตารางที่จะจำประวัติว่ามีโปรเจกต์ไหนถูก Deploy ไปบ้าง
type Deployment struct {
	ID          uint      `gorm:"primaryKey"`          // รหัสลำดับ
	RepoURL     string    `gorm:"not null"`            // ลิงก์ GitHub ของลูกค้า
	GitToken    string    `gorm:"type:text"`           // Token สำหรับดึง Private Repo
	ImageName   string    // ชื่อ Image ที่ Build ได้
	ContainerID string    // รหัส Container
	DomainName  string    // ชื่อโดเมนสำหรับเข้าเว็บ
	Status      string    `gorm:"default:'running'"`   // สถานะ (running, stopped, failed)
	ForceAI       bool      `gorm:"default:false"`       // บังคับให้ AI เขียน Dockerfile ทับ
	WebhookSecret string    `json:"webhook_secret"`      // Secret สำหรับยืนยันตัวตนกับ GitHub Webhook
	AutoDeploy    bool      `gorm:"default:true" json:"auto_deploy"` // เปิด/ปิด Auto-Deploy เมื่อมี push
	LastError     string    `gorm:"type:text"`           // บันทึก Error ล่าสุดถ้าระบบพัง
	CreatedAt     time.Time `gorm:"autoCreateTime"`      // วันเวลาที่ Deploy
	UpdatedAt     time.Time `gorm:"autoUpdateTime"`      // วันเวลาที่แก้ไขสถานะล่าสุด
}
