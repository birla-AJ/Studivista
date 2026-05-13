const isAdmin = user => user?.role === 'admin';
const isTeacher = user => user?.role === 'teacher';
const isStudent = user => user?.role === 'student';

const requireRoles = (...roles) => (req, res, next) => {
  if (roles.includes(req.user?.role)) return next();
  return res.status(403).json({ error: 'Not allowed.' });
};

const requireSelfOrAdmin = getUid => (req, res, next) => {
  const uid = typeof getUid === 'function' ? getUid(req) : getUid;
  if (isAdmin(req.user) || req.user?.uid === uid) return next();
  return res.status(403).json({ error: 'Not allowed.' });
};

module.exports = {
  isAdmin,
  isTeacher,
  isStudent,
  requireRoles,
  requireSelfOrAdmin,
};
