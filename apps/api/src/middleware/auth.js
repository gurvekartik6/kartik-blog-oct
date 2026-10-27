export function requireAdmin(req, res, next) {
  if (req.session?.user?.role === 'admin') return next();
  return res.status(401).json({ error: 'Administrator authentication required.' });
}
