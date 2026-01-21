const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

dotenv.config();

const GRPC_HOST = process.env.GRPC_HOST || "localhost:50051";
const PORT = process.env.PORT || 4000;

const protoPath = path.join(__dirname, "..", "proto", "library.proto");
const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const libraryProto = grpc.loadPackageDefinition(packageDefinition).library;
const client = new libraryProto.LibraryService(
  GRPC_HOST,
  grpc.credentials.createInsecure()
);

function grpcCall(method, payload) {
  return new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) {
        const message = err.details || err.message || "Unknown error";
        return reject({ code: err.code, message });
      }
      resolve(response);
    });
  });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/books", async (req, res) => {
  try {
    const data = await grpcCall("ListBooks", {});
    res.json(data.books || []);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/books", async (req, res) => {
  try {
    const data = await grpcCall("CreateBook", { book: req.body });
    res.status(201).json(data.book);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.put("/books/:id", async (req, res) => {
  try {
    const book = { ...req.body, id: Number(req.params.id) };
    const data = await grpcCall("UpdateBook", { book });
    res.json(data.book);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.get("/members", async (req, res) => {
  try {
    const data = await grpcCall("ListMembers", {});
    res.json(data.members || []);
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/members", async (req, res) => {
  try {
    const data = await grpcCall("CreateMember", { member: req.body });
    res.status(201).json(data.member);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.put("/members/:id", async (req, res) => {
  try {
    const member = { ...req.body, id: Number(req.params.id) };
    const data = await grpcCall("UpdateMember", { member });
    res.json(data.member);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.post("/loans/borrow", async (req, res) => {
  try {
    const data = await grpcCall("BorrowBook", req.body);
    res.status(201).json(data.loan);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.post("/loans/return", async (req, res) => {
  try {
    const data = await grpcCall("ReturnBook", req.body);
    res.json(data.loan);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.get("/loans/borrowed", async (req, res) => {
  try {
    const memberId = Number(req.query.member_id || 0);
    const data = await grpcCall("ListBorrowedBooks", { member_id: memberId });
    res.json(data.loans || []);
  } catch (err) {
    res.status(400).json(err);
  }
});

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`);
});