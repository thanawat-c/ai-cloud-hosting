package models

// DeployRequest represents the incoming JSON payload for deployment
type DeployRequest struct {
    RepoURL      string `json:"repo_url" binding:"required"`
    Branch       string `json:"branch"`
    EnvVars      string `json:"env_vars"`
    ForceAI      bool   `json:"force_ai"`
    GitToken     string `json:"git_token"`
    AutoCreateDB bool   `json:"auto_create_db"`
    WorkspaceID  string `json:"workspace_id"`
    RootDir      string `json:"root_dir"`
    BuildCmd     string `json:"build_cmd"`
    InstallCmd   string `json:"install_cmd"`
    StartCmd     string `json:"start_cmd"`
    OutputDir    string `json:"output_dir"`
    NodeVersion  string `json:"node_version"`
}

type UpdateProjectSettingsRequest struct {
    RootDir     string `json:"root_dir"`
    BuildCmd    string `json:"build_cmd"`
    InstallCmd  string `json:"install_cmd"`
    StartCmd    string `json:"start_cmd"`
    OutputDir   string `json:"output_dir"`
    NodeVersion string `json:"node_version"`
    AutoDeploy  *bool  `json:"auto_deploy"`
}


// ContainerDTO represents the standardized format for a container returned to the frontend
type ContainerDTO struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Image      string `json:"image"`
	Status     string `json:"status"`
	State      string `json:"state"`
	PublicPort uint16 `json:"public_port"`
	DomainName string `json:"domain_name"`
	LastError  string `json:"last_error"`
}


