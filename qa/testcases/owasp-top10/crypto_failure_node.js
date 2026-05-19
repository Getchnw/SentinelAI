const crypto = require('crypto');

function hashPassword(password) {
    // Vulnerable: Using MD5 for password hashing is insecure
    return crypto.createHash('md5').update(password).digest('hex');
}
