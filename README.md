# Neighborhood Library Service

A small full-stack application for managing books, members, and borrowing/returning operations.

## Stack
- Python gRPC server
- PostgreSQL database
- Node.js API gateway (REST -> gRPC)
- React UI (Vite)

## Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ (or Docker Desktop)

## Project layout
- `db/schema.sql` - database schema
- `proto/library.proto` - gRPC service definition
- `server/` - Python gRPC server
- `gateway/` - Node API gateway
- `web/` - React UI

## Database setup

Option A: Docker (recommended)

```bash
cd "c:\Users\Bhara\OneDrive\Desktop\New folder (2)\library-service"
docker compose up -d
```

Load the schema:

```bash
psql -h localhost -U postgres -d library -f db/schema.sql
```

Option B: Local Postgres
- Create database `library`
- Run `db/schema.sql`

## Generate gRPC code (Python)

```bash
cd server
python -m grpc_tools.protoc -I ..\proto --python_out=. --grpc_python_out=. ..\proto\library.proto
```

This generates `library_pb2.py` and `library_pb2_grpc.py` inside `server/`.

## Run the Python gRPC server

```bash
cd server
pip install -r requirements.txt
copy .env.example .env
python server.py
```

The server listens on `localhost:50051`.

## Run the Node API gateway

```bash
cd gateway
npm install
copy .env.example .env
npm start
```

The gateway listens on `http://localhost:4000`.

## Run the React UI

```bash
cd web
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## REST endpoints (gateway)
- `GET /books`
- `POST /books`
- `PUT /books/:id`
- `GET /members`
- `POST /members`
- `PUT /members/:id`
- `POST /loans/borrow`
- `POST /loans/return`
- `GET /loans/borrowed?member_id=1`

## Notes
- Borrowing a book that is already checked out returns an error.
- The `loans_active_book_idx` partial index guarantees only one active loan per book.

## Sample payloads

Create book:
```json
{
  "title": "The Left Hand of Darkness",
  "author": "Ursula K. Le Guin",
  "isbn": "9780441478125",
  "published_year": 1969
}
```

Create member:
```json
{
  "name": "Sam Patel",
  "email": "sam@example.com",
  "phone": "555-0192"
}
```

Borrow book:
```json
{
  "book_id": 1,
  "member_id": 1,
  "due_at": "2024-12-01"
}
```

Return book:
```json
{
  "loan_id": 1
}
```

## Quick curl tests (Windows)

Create a book:
```bat
curl -X POST http://localhost:4000/books ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Dune\",\"author\":\"Frank Herbert\",\"isbn\":\"9780441013593\",\"published_year\":1965}"
```

Create a member:
```bat
curl -X POST http://localhost:4000/members ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Sam Patel\",\"email\":\"sam@example.com\",\"phone\":\"555-0192\"}"
```

Borrow a book (note `due_at`):
```bat
curl -X POST http://localhost:4000/loans/borrow ^
  -H "Content-Type: application/json" ^
  -d "{\"book_id\":1,\"member_id\":1,\"due_at\":\"2026-02-01\"}"
```

Return a book:
```bat
curl -X POST http://localhost:4000/loans/return ^
  -H "Content-Type: application/json" ^
  -d "{\"loan_id\":1}"
```
