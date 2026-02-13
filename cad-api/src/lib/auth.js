import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'irp_cad';

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function setAuthCookie(res, token) {
  const isProd = (process.env.NODE_ENV || 'production') === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function getAuthCookie(req) {
  return (req.cookies && req.cookies[COOKIE_NAME]) ? req.cookies[COOKIE_NAME] : null;
}
