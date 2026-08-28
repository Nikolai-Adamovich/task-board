#!/usr/bin/env bash
#
# One-command local startup for the Task Board monorepo.
# Builds the shared workspace, starts MongoDB via docker compose (idempotent,
# includes healthcheck + rs.initiate), then opens a zellij layout with
# server (wrangler dev) and ui (ng serve) panes side by side.
#
# Assumes: Docker, zellij and konsole are installed.

set -e

PROJECT_DIR="$HOME/Projects/task-board"

cd "$PROJECT_DIR"

echo "Building shared..."
npm run build --workspace=shared

cat >/tmp/task-board.kdl <<EOF
layout {
    pane split_direction="vertical" {

        pane {
            command "bash"
            args "-c" "docker compose up -d && cd '$PROJECT_DIR' && npm run dev -w server"
        }

        pane {
            command "bash"
            args "-c" "cd '$PROJECT_DIR' && rm -rf 'ui/.angular' && npm run start -w ui"
        }
    }
}
EOF

konsole -e zellij --layout /tmp/task-board.kdl
