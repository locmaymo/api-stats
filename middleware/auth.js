import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Middleware xác thực API key
export const authenticateApiKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }
  
  const apiKey = authHeader.substring(7);
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Middleware xác thực admin
export const authenticateAdmin = (req, res, next) => {
  const token = req.cookies?.adminToken || req.headers.authorization?.substring(7);
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};

// Hàm login admin
export const adminLogin = async (req, res) => {
  const { username, password } = req.body;
  
  if (username !== process.env.ADMIN_USERNAME) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  // Hash password để so sánh (trong production nên lưu hash trong DB)
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  const validPassword = await bcrypt.compare(password, hashedPassword);
  
  if (!validPassword) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { username: username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
  
  res.json({ message: 'Login successful', token });
};