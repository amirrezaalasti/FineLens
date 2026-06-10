.PHONY: up down backend frontend seed install

up:
	docker compose up -d

down:
	docker compose down

install:
	cd backend && python -m venv .venv && . .venv/bin/activate && pip install -e .
	cd frontend && npm install

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

seed:
	cd backend && . .venv/bin/activate && python scripts/seed.py
