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
	Branch        string    `gorm:"type:varchar(100);default:'main'" json:"branch"` // ชื่อ Git Branch
	CommitHash    string    `gorm:"type:varchar(40)" json:"commit_hash"`             // รหัส Commit ย่อ 7 หลัก
	CommitMessage string    `gorm:"type:text" json:"commit_message"`                // ข้อความ Commit ล่าสุด
	AuthorName    string    `gorm:"type:varchar(100)" json:"author_name"`           // ชื่อผู้ Commit หรือ Deployer
	AuthorAvatar  string    `gorm:"type:varchar(255)" json:"author_avatar"`         // URL รูป Avatar ของ Deployer
	LastError     string    `gorm:"type:text"`           // บันทึก Error ล่าสุดถ้าระบบพัง
	CreatedAt     time.Time `gorm:"autoCreateTime"`      // วันเวลาที่ Deploy
	UpdatedAt     time.Time `gorm:"autoUpdateTime"`      // วันเวลาที่แก้ไขสถานะล่าสุด
}
