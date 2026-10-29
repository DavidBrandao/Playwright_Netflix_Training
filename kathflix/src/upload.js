const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const { httpError } = require('./errors');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

function makeUpload(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (req, file, cb) =>
        cb(null, `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      ALLOWED_EXT.has(path.extname(file.originalname).toLowerCase()) && file.mimetype.startsWith('image/') ? cb(null, true) : cb(httpError(400, 'Apenas imagens PNG, JPG, GIF ou WEBP são permitidas')),
  });
}

// Se o handler falhar depois do multer salvar o arquivo, apaga o arquivo órfão.
function discardFileOnError(handler) {
  return (req, res, next) => {
    try {
      return handler(req, res, next);
    } catch (err) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch { /* já removido */ }
      }
      throw err;
    }
  };
}

module.exports = { makeUpload, discardFileOnError };
