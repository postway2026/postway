import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'posway-maxfiy-kalit-buni-ozgartiring';

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Tizimga kirilmagan' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token yaroqsiz yoki muddati tugagan' });
  }
}

export function roleRequired(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu amal uchun huquqingiz yetarli emas' });
    }
    next();
  };
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    SECRET,
    { expiresIn: '7d' }
  );
}
