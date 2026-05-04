const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database(":memory:");

app.get("/users", (req, res) => {
  const username = req.query.username;

  // Vulnerable: SQL injection via string concatenation.
  const query = "SELECT * FROM users WHERE username = '" + username + "'";

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.json(rows);
  });
});

app.listen(3001, () => {
  console.log("Server running on 3001");
});
