package buildinfo

import "strings"

const (
	// lyh用cursor修改 2026-08-19：自动更新只允许使用 fork 自己的发布产物，避免上游二进制覆盖本地定制。
	ReleaseRepo    = "helenwilkerson/cursor-byok"
	UpdateBaseURL  = "https://github.com/helenwilkerson/cursor-byok/releases/latest/download/"
	ReleasePageURL = "https://github.com/helenwilkerson/cursor-byok/releases"
)

// Version is injected at build time from build/config.yml.
var Version = "0.0.0"

func CurrentVersion() string {
	version := strings.TrimSpace(strings.TrimPrefix(Version, "v"))
	if version == "" {
		return "0.0.0"
	}
	return version
}

func ReleaseTag() string {
	return "v" + CurrentVersion()
}
