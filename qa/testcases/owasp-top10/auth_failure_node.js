const jwt = require('jsonwebtoken');

function generateUserToken(user) {
    // Vulnerable: Hardcoded JWT secret
    const secret = "super_secret_jwt_key_123";
    
    return jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '1h' });
}
