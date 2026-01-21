import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function api(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Request failed");
  }
  return res.json();
}

export default function App() {
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);
  const [borrowed, setBorrowed] = useState([]);
  const [bookForm, setBookForm] = useState({
    title: "",
    author: "",
    isbn: "",
    published_year: "",
  });
  const [memberForm, setMemberForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [borrowForm, setBorrowForm] = useState({
    book_id: "",
    member_id: "",
    due_at: "",
  });
  const [borrowLookupMember, setBorrowLookupMember] = useState("");
  const [status, setStatus] = useState("Ready");

  async function loadBooks() {
    const data = await api("/books");
    setBooks(data);
  }

  async function loadMembers() {
    const data = await api("/members");
    setMembers(data);
  }

  async function loadBorrowed(memberId) {
    const data = await api(`/loans/borrowed?member_id=${memberId}`);
    setBorrowed(data);
  }

  useEffect(() => {
    Promise.all([loadBooks(), loadMembers()]).catch((err) => {
      setStatus(err.message);
    });
  }, []);

  async function handleCreateBook(event) {
    event.preventDefault();
    setStatus("Creating book...");
    try {
      const payload = {
        ...bookForm,
        published_year: bookForm.published_year
          ? Number(bookForm.published_year)
          : 0,
      };
      await api("/books", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBookForm({ title: "", author: "", isbn: "", published_year: "" });
      await loadBooks();
      setStatus("Book created");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleCreateMember(event) {
    event.preventDefault();
    setStatus("Creating member...");
    try {
      await api("/members", {
        method: "POST",
        body: JSON.stringify(memberForm),
      });
      setMemberForm({ name: "", email: "", phone: "" });
      await loadMembers();
      setStatus("Member created");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleBorrow(event) {
    event.preventDefault();
    setStatus("Recording loan...");
    try {
      const payload = {
        book_id: Number(borrowForm.book_id),
        member_id: Number(borrowForm.member_id),
        due_at: borrowForm.due_at,
      };
      await api("/loans/borrow", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBorrowForm({ book_id: "", member_id: "", due_at: "" });
      setStatus("Loan recorded");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleReturn(loanId) {
    setStatus("Returning book...");
    try {
      await api("/loans/return", {
        method: "POST",
        body: JSON.stringify({ loan_id: loanId }),
      });
      if (borrowLookupMember) {
        await loadBorrowed(borrowLookupMember);
      }
      setStatus("Book returned");
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function handleBorrowedLookup(event) {
    event.preventDefault();
    if (!borrowLookupMember) {
      setStatus("Enter a member id");
      return;
    }
    setStatus("Loading borrowed books...");
    try {
      await loadBorrowed(borrowLookupMember);
      setStatus("Borrowed list updated");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-content">
          <p className="eyebrow">Neighborhood Library Service</p>
          <h1>Borrowing made calm, quick, and trackable.</h1>
          <p className="subtext">
            Manage books, members, and loans with a clean workflow that keeps
            every checkout visible.
          </p>
          <div className="status">{status}</div>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Books</h2>
          <p className="card-note">Current inventory</p>
          <div className="list">
            {books.length === 0 ? (
              <div className="empty">No books yet.</div>
            ) : (
              books.map((book) => (
                <div key={book.id} className="list-item">
                  <div>
                    <strong>{book.title}</strong>
                    <div className="muted">{book.author}</div>
                  </div>
                  <div className="meta">#{book.id}</div>
                </div>
              ))
            )}
          </div>
          <button className="ghost" onClick={loadBooks}>
            Refresh books
          </button>
        </section>

        <section className="card">
          <h2>Add Book</h2>
          <p className="card-note">Create a new title</p>
          <form className="form" onSubmit={handleCreateBook}>
            <input
              placeholder="Title"
              value={bookForm.title}
              onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
              required
            />
            <input
              placeholder="Author"
              value={bookForm.author}
              onChange={(e) =>
                setBookForm({ ...bookForm, author: e.target.value })
              }
              required
            />
            <input
              placeholder="ISBN"
              value={bookForm.isbn}
              onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
            />
            <input
              placeholder="Published year"
              value={bookForm.published_year}
              onChange={(e) =>
                setBookForm({ ...bookForm, published_year: e.target.value })
              }
            />
            <button type="submit">Save book</button>
          </form>
        </section>

        <section className="card">
          <h2>Members</h2>
          <p className="card-note">Active patrons</p>
          <div className="list">
            {members.length === 0 ? (
              <div className="empty">No members yet.</div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="list-item">
                  <div>
                    <strong>{member.name}</strong>
                    <div className="muted">{member.email || "No email"}</div>
                  </div>
                  <div className="meta">#{member.id}</div>
                </div>
              ))
            )}
          </div>
          <button className="ghost" onClick={loadMembers}>
            Refresh members
          </button>
        </section>

        <section className="card">
          <h2>Add Member</h2>
          <p className="card-note">Create a new member profile</p>
          <form className="form" onSubmit={handleCreateMember}>
            <input
              placeholder="Full name"
              value={memberForm.name}
              onChange={(e) =>
                setMemberForm({ ...memberForm, name: e.target.value })
              }
              required
            />
            <input
              placeholder="Email"
              type="email"
              value={memberForm.email}
              onChange={(e) =>
                setMemberForm({ ...memberForm, email: e.target.value })
              }
            />
            <input
              placeholder="Phone"
              value={memberForm.phone}
              onChange={(e) =>
                setMemberForm({ ...memberForm, phone: e.target.value })
              }
            />
            <button type="submit">Save member</button>
          </form>
        </section>

        <section className="card wide">
          <h2>Borrow Book</h2>
          <p className="card-note">Record a checkout</p>
          <form className="form horizontal" onSubmit={handleBorrow}>
            <input
              placeholder="Book ID"
              value={borrowForm.book_id}
              onChange={(e) =>
                setBorrowForm({ ...borrowForm, book_id: e.target.value })
              }
              required
            />
            <input
              placeholder="Member ID"
              value={borrowForm.member_id}
              onChange={(e) =>
                setBorrowForm({ ...borrowForm, member_id: e.target.value })
              }
              required
            />
            <input
              placeholder="Due date (YYYY-MM-DD)"
              value={borrowForm.due_at}
              onChange={(e) =>
                setBorrowForm({ ...borrowForm, due_at: e.target.value })
              }
            />
            <button type="submit">Record loan</button>
          </form>
        </section>

        <section className="card wide">
          <h2>Borrowed Books</h2>
          <p className="card-note">Lookup by member</p>
          <form className="form horizontal" onSubmit={handleBorrowedLookup}>
            <input
              placeholder="Member ID"
              value={borrowLookupMember}
              onChange={(e) => setBorrowLookupMember(e.target.value)}
              required
            />
            <button type="submit">Load borrowed list</button>
          </form>
          <div className="list">
            {borrowed.length === 0 ? (
              <div className="empty">No borrowed books loaded.</div>
            ) : (
              borrowed.map((loan) => (
                <div key={loan.id} className="list-item">
                  <div>
                    <strong>Loan #{loan.id}</strong>
                    <div className="muted">
                      Book {loan.book_id} - borrowed {loan.borrowed_at || ""}
                    </div>
                  </div>
                  <button className="ghost" onClick={() => handleReturn(loan.id)}>
                    Mark returned
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}