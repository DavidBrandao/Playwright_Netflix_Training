class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const httpError = (status, message) => new HttpError(status, message);

function notFound(req, res, next) {
  next(httpError(404, 'Rota não encontrada'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Imagem acima de 2 MB' : err.message;
    return res.status(400).json({ error: msg });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno' });
}

module.exports = { HttpError, httpError, notFound, errorHandler };
