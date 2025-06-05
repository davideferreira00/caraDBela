const attempts = new Map();

module.exports = async function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();

  if (!attempts.has(ip)) {
    attempts.set(ip, { count: 0, lastAttempt: now, blockedUntil: 0, reported: false });
  }

  const entry = attempts.get(ip);

  if (now < entry.blockedUntil) {
    const secondsLeft = Math.ceil((entry.blockedUntil - now) / 1000);
    return res.status(429).json({
      message: `Muitas tentativas. Tente novamente em ${secondsLeft} segundos.`,
    });
  }

  entry.count++;
  entry.lastAttempt = now;

  if (entry.count > 10) {
    entry.blockedUntil = now + 5 * 60 * 1000;
    entry.reported = false;
  } else if (entry.count > 5) {
    entry.blockedUntil = now + 1 * 60 * 1000;
    entry.reported = false;
  }

  attempts.set(ip, entry);

  req.loginAttemptInfo = entry;

  next();
};
