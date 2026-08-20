package server

import (
	"context"
	"net/url"
	"path/filepath"
	"testing"

	serverconfig "cursor/internal/backend/server/config"
)

func TestRoutePolicyOnlyForwardsConfiguredUpstreamRequests(t *testing.T) {
	store := serverconfig.NewStore(filepath.Join(t.TempDir(), "config.yaml"), t.TempDir())
	manager, err := serverconfig.NewManager(context.Background(), store)
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	upstreamURL, err := url.Parse("https://api2.cursor.sh/test")
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	forwarded := 0
	continued := 0
	middleware := RoutePolicy(manager, func(*Context) error {
		forwarded++
		return nil
	})
	next := middleware(func(*Context) error {
		continued++
		return nil
	})

	if err := next(&Context{UpstreamURL: upstreamURL}); err != nil {
		t.Fatalf("local route error = %v", err)
	}
	if forwarded != 0 || continued != 1 {
		t.Fatalf("local route forwarded=%d continued=%d", forwarded, continued)
	}

	cfg := manager.Current()
	cfg.Routing.Mode = "upstream"
	if _, err := manager.Save(context.Background(), cfg); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if err := next(&Context{UpstreamURL: upstreamURL}); err != nil {
		t.Fatalf("upstream route error = %v", err)
	}
	if forwarded != 1 || continued != 1 {
		t.Fatalf("upstream route forwarded=%d continued=%d", forwarded, continued)
	}

	if err := next(&Context{}); err != nil {
		t.Fatalf("native route error = %v", err)
	}
	if forwarded != 1 || continued != 2 {
		t.Fatalf("native route forwarded=%d continued=%d", forwarded, continued)
	}
}
