package models

import (
	"time"
)

// Deployment คือโครงสร้างตารางที่จะจำประวัติว่ามีโปรเจกต์ไหนถูก Deploy ไปบ้าง
type Deployment struct {
	ID          uint      `gorm:"primaryKey"`          // รหัสลำดับ
	WorkspaceID string    `gorm:"type:varchar(50);default:'personal';index" json:"workspace_id"` // Workspace ที่สังกัด
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
	CustomDomain      string    `gorm:"type:varchar(255)" json:"custom_domain"`         // โดเมนเนมที่ผู้ใช้กำหนดเอง
	SSLEnabled        bool      `gorm:"default:false" json:"ssl_enabled"`               // สถานะการเปิดใช้งาน SSL / HTTPS
	SSLStatus         string    `gorm:"type:varchar(50);default:'inactive'" json:"ssl_status"` // inactive, local, active
	SSLForceRedirect  bool      `gorm:"default:true" json:"ssl_force_redirect"`         // บังคับเปลี่ยนเส้นทาง HTTP ไปยัง HTTPS
	LastError         string    `gorm:"type:text"`           // บันทึก Error ล่าสุดถ้าระบบพัง
	CreatedAt     time.Time `gorm:"autoCreateTime"`      // วันเวลาที่ Deploy
	UpdatedAt     time.Time `gorm:"autoUpdateTime"`      // วันเวลาที่แก้ไขสถานะล่าสุด
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

