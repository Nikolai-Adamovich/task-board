#!/usr/bin/env bash

PROJECT_DIR="$HOME/Projects/task-board"

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
