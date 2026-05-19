const express = require('express');
const app = express();

// Vulnerable: No role validation before deleting a user
app.post('/admin/delete-user', (req, res) => {
    const userId = req.body.userId;
    
    // Missing check: if (req.user.role !== 'admin') { return res.status(403).send('Forbidden'); }
    deleteUserFromDatabase(userId);
    
    res.send(`User ${userId} deleted`);
});

function deleteUserFromDatabase(id) {
    console.log(`Deleting ${id}`);
}
