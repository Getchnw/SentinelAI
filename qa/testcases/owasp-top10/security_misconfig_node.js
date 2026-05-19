const express = require('express');
const app = express();

app.get('/data', (req, res) => {
    throw new Error("Database connection failed!");
});

// Vulnerable: Exposing full stack traces to the client in production
app.use((err, req, res, next) => {
    res.status(500).send({
        error: "An error occurred",
        stack: err.stack 
    });
});
