export function notFoundHandler(_request, _response, next) {
  const error = new Error('Route not found');
  error.status = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const status = error.code === 'ER_DUP_ENTRY'
    ? 409
    : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

  if (status === 500) {
    console.error('Unhandled request error');
  }

  response.status(status).json({
    success: false,
    message: status === 500
      ? 'Une erreur interne est survenue.'
      : error.code === 'ER_DUP_ENTRY'
        ? 'Une valeur identique existe déjà.'
        : error.message,
    ...(error.errors ? { errors: error.errors } : {}),
  });
}
