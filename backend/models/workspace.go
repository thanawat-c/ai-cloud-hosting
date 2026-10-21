package models

import "time"

// Workspace โมเดลสำหรับแบ่งสิทธิ์และแยกพื้นที่ทำงาน (Multi-Tenancy)
type Workspace struct {
	ID          string    `gorm:"primaryKey;type:varchar(50)" json:"id"`  // e.g. "personal", "engineering"
	Name        string    `gorm:"type:varchar(100);not null" json:"name"` // e.g. "Personal (Pro)", "Engineering Team"
	Slug        string    `gorm:"type:varchar(50);uniqueIndex" json:"slug"`
	Type        string    `gorm:"type:varchar(20);default:'personal'" json:"type"` // personal, team
	Plan        string    `gorm:"type:varchar(20);default:'Pro'" json:"plan"`
	Color       string    `gorm:"type:varchar(30);default:'emerald'" json:"color"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt   time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// WorkspaceSummary ข้อมูลสรุปของ Workspace พร้อมตัวเลขนับ Service และ DB
type WorkspaceSummary struct {
	Workspace
	DeploymentsCount int64 `json:"deployments_count"`
	DatabasesCount   int64 `json:"databases_count"`
	ActiveContainers int64 `json:"active_containers"`
}
