#!/bin/bash
echo "Starting Stock Terminal..."
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"

# Start backend
cd "$(dirname "$0")/backend"
uvicorn server:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!

echo "Press Ctrl+C to stop both servers"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
