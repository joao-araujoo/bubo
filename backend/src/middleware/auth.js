const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { updateRequestContext } = require('../observability/requestContext');

const respond = (res, status, message, code, requestId) => res.status(status).json({
  message,
  code,
  requestId,
});

const authMiddleware = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return respond(
        res,
        500,
        'A autenticação está temporariamente indisponível.',
        'AUTH_CONFIGURATION_ERROR',
        req.requestId,
      );
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return respond(res, 401, 'Faça login para continuar.', 'AUTH_TOKEN_REQUIRED', req.requestId);
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return respond(res, 401, 'Esta conta não está mais disponível.', 'AUTH_USER_NOT_FOUND', req.requestId);
    }

    req.user = user;
    updateRequestContext({ userId: String(user._id) });
    return next();
  } catch (error) {
    return respond(res, 401, 'Sua sessão expirou ou é inválida.', 'AUTH_TOKEN_INVALID', req.requestId);
  }
};

module.exports = authMiddleware;
