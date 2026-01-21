import os
from concurrent import futures
from datetime import datetime

import grpc
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

import library_pb2
import library_pb2_grpc

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "library")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


def get_conn():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def row_to_book(row):
    return library_pb2.Book(
        id=row["id"],
        title=row["title"],
        author=row["author"],
        isbn=row["isbn"] or "",
        published_year=row["published_year"] or 0,
    )


def row_to_member(row):
    return library_pb2.Member(
        id=row["id"],
        name=row["name"],
        email=row["email"] or "",
        phone=row["phone"] or "",
    )


def row_to_loan(row):
    def to_iso(value):
        return value.isoformat() if value else ""

    return library_pb2.Loan(
        id=row["id"],
        book_id=row["book_id"],
        member_id=row["member_id"],
        borrowed_at=to_iso(row["borrowed_at"]),
        due_at=to_iso(row["due_at"]),
        returned_at=to_iso(row["returned_at"]),
    )


class LibraryService(library_pb2_grpc.LibraryServiceServicer):
    def CreateBook(self, request, context):
        book = request.book
        if not book.title or not book.author:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "title and author are required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO books (title, author, isbn, published_year)
                VALUES (%s, %s, %s, %s)
                RETURNING id, title, author, isbn, published_year
                """,
                (book.title, book.author, book.isbn or None, book.published_year or None),
            )
            row = cur.fetchone()

        return library_pb2.BookResponse(book=row_to_book(row))

    def UpdateBook(self, request, context):
        book = request.book
        if book.id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "book id is required")
        if not book.title or not book.author:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "title and author are required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                UPDATE books
                SET title = %s,
                    author = %s,
                    isbn = %s,
                    published_year = %s
                WHERE id = %s
                RETURNING id, title, author, isbn, published_year
                """,
                (book.title, book.author, book.isbn or None, book.published_year or None, book.id),
            )
            row = cur.fetchone()

        if not row:
            context.abort(grpc.StatusCode.NOT_FOUND, "book not found")

        return library_pb2.BookResponse(book=row_to_book(row))

    def ListBooks(self, request, context):
        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT id, title, author, isbn, published_year FROM books ORDER BY id"
            )
            rows = cur.fetchall()

        books = [row_to_book(row) for row in rows]
        return library_pb2.ListBooksResponse(books=books)

    def CreateMember(self, request, context):
        member = request.member
        if not member.name:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "name is required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                INSERT INTO members (name, email, phone)
                VALUES (%s, %s, %s)
                RETURNING id, name, email, phone
                """,
                (member.name, member.email or None, member.phone or None),
            )
            row = cur.fetchone()

        return library_pb2.MemberResponse(member=row_to_member(row))

    def UpdateMember(self, request, context):
        member = request.member
        if member.id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "member id is required")
        if not member.name:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "name is required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                UPDATE members
                SET name = %s,
                    email = %s,
                    phone = %s
                WHERE id = %s
                RETURNING id, name, email, phone
                """,
                (member.name, member.email or None, member.phone or None, member.id),
            )
            row = cur.fetchone()

        if not row:
            context.abort(grpc.StatusCode.NOT_FOUND, "member not found")

        return library_pb2.MemberResponse(member=row_to_member(row))

    def ListMembers(self, request, context):
        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT id, name, email, phone FROM members ORDER BY id")
            rows = cur.fetchall()

        members = [row_to_member(row) for row in rows]
        return library_pb2.ListMembersResponse(members=members)

    def BorrowBook(self, request, context):
        if request.book_id <= 0 or request.member_id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "book_id and member_id are required")

        due_at = None
        if request.due_at:
            try:
                due_at = datetime.fromisoformat(request.due_at)
            except ValueError:
                context.abort(grpc.StatusCode.INVALID_ARGUMENT, "due_at must be ISO format")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute("SELECT id FROM books WHERE id = %s", (request.book_id,))
            if not cur.fetchone():
                context.abort(grpc.StatusCode.NOT_FOUND, "book not found")

            cur.execute("SELECT id FROM members WHERE id = %s", (request.member_id,))
            if not cur.fetchone():
                context.abort(grpc.StatusCode.NOT_FOUND, "member not found")

            cur.execute(
                """
                SELECT id FROM loans
                WHERE book_id = %s AND returned_at IS NULL
                """,
                (request.book_id,),
            )
            if cur.fetchone():
                context.abort(grpc.StatusCode.FAILED_PRECONDITION, "book already checked out")

            cur.execute(
                """
                INSERT INTO loans (book_id, member_id, due_at)
                VALUES (%s, %s, %s)
                RETURNING id, book_id, member_id, borrowed_at, due_at, returned_at
                """,
                (request.book_id, request.member_id, due_at),
            )
            row = cur.fetchone()

        return library_pb2.LoanResponse(loan=row_to_loan(row))

    def ReturnBook(self, request, context):
        if request.loan_id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "loan_id is required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                UPDATE loans
                SET returned_at = NOW()
                WHERE id = %s AND returned_at IS NULL
                RETURNING id, book_id, member_id, borrowed_at, due_at, returned_at
                """,
                (request.loan_id,),
            )
            row = cur.fetchone()

        if not row:
            context.abort(grpc.StatusCode.NOT_FOUND, "loan not found or already returned")

        return library_pb2.LoanResponse(loan=row_to_loan(row))

    def ListBorrowedBooks(self, request, context):
        if request.member_id <= 0:
            context.abort(grpc.StatusCode.INVALID_ARGUMENT, "member_id is required")

        with get_conn() as conn, conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                """
                SELECT id, book_id, member_id, borrowed_at, due_at, returned_at
                FROM loans
                WHERE member_id = %s AND returned_at IS NULL
                ORDER BY borrowed_at DESC
                """,
                (request.member_id,),
            )
            rows = cur.fetchall()

        loans = [row_to_loan(row) for row in rows]
        return library_pb2.ListBorrowedBooksResponse(loans=loans)


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    library_pb2_grpc.add_LibraryServiceServicer_to_server(LibraryService(), server)
    server.add_insecure_port("[::]:50051")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()