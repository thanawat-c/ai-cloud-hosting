package models

import "time"

// APIToken โมเดลสำหรับเก็บ API Token ที่ผู้ใช้สร้างขึ้นสำหรับเรียกใช้งานผ่าน cURL / CI-CD
type APIToken struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	WorkspaceID string     `gorm:"type:varchar(50);default:'personal';index" json:"workspace_id"`
	Name        string     `gorm:"type:varchar(100);not null" json:"name"`
	Token       string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"token"` // จะถูก mask ในการเรียก list ทั่วไป
	MaskedToken string     `gorm:"-" json:"masked_token,omitempty"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedAt   time.Time  `gorm:"autoCreateTime" json:"created_at"`
}
