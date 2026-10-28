#!/usr/bin/env bash
set -e

# FridgeChef Local Runner (No Docker Required)
echo "🍳 Starting FridgeChef in Local Development Mode..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure backend directory is in PYTHONPATH
export PYTHONPATH="$SCRIPT_DIR/backend:$PYTHONPATH"

# 1. Setup Backend Environment
if [ ! -d "backend/.venv" ]; then
    echo "Creating Python virtual environment in backend/.venv..."
    /opt/homebrew/bin/python3.14 -m venv backend/.venv || python3 -m venv backend/.venv
    ./backend/.venv/bin/pip install --upgrade pip
    ./backend/.venv/bin/pip install -r backend/requirements.txt
fi

if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

# 2. Setup Frontend Environment
if [ ! -d "frontend/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# 3. Seed / Initialize Database
echo "Initializing SQLite database with seed data..."
./backend/.venv/bin/python -m app.infrastructure.db.init_db

# 4. Start Servers
echo "Starting Backend on http://localhost:8000..."
./backend/.venv/bin/uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

echo "Starting Frontend on http://localhost:5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

cleanup() {
    echo ""
    echo "Stopping FridgeChef..."
    kill "$BACKEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

echo "✨ FridgeChef is running!"
echo "👉 Web App:  http://localhost:5173"
echo "👉 API Docs: http://localhost:8000/docs"
echo "Press Ctrl+C to stop."

wait
