#!/usr/bin/env bash

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
            args "-c" "docker start task-board-mongo && cd '$PROJECT_DIR' && npm run dev -w server"
        }

        pane {
            command "bash"
            args "-c" "cd '$PROJECT_DIR' && rm -rf 'ui/.angular' && npm run start -w ui"
        }
    }
}
EOF

konsole -e zellij --layout /tmp/task-board.kdl
