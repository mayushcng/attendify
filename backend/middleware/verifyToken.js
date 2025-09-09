const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).send('Access Denied. No token provided.');

  const token = authHeader.split(' ')[1]; // Expecting "Bearer TOKEN"
  if (!token) return res.status(401).send('Access Denied. No token provided.');

  try {
    const decoded = jwt.verify(token, 'your_jwt_secret_key');
    req.teacher = decoded;
    next(); // Token is valid, proceed to the next function
  } catch (ex) {
    res.status(400).send('Invalid Token.');
  }
};