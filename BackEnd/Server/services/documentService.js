// services/documentService.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { run, get, all } = require('../../DBMS/db/db');
const { v4: uuidv4 } = require('uuid');

const STORAGE_DIR = path.join(__dirname, '..', '..', 'DBMS', 'storage', 'analysis_results');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

async function storeFileFromBuffer(buffer, originalName, mimetype, sessionId) {
  const id = uuidv4();
  const safeName = `${id}_${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storagePath = path.join(STORAGE_DIR, safeName);

  fs.writeFileSync(storagePath, buffer);

  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const size = buffer.length;
  const createdAt = new Date().toISOString();

  const insertSQL = `
    INSERT INTO documents (id, session_id, file_name, file_type, storage_path, created_at, checksum_hash, size_bytes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  await run(insertSQL, [id, sessionId, originalName, mimetype, storagePath, createdAt, checksum, size]);

  return {
    id, sessionId, fileName: originalName, fileType: mimetype, storagePath, createdAt, checksum, size
  };
}

async function getDocumentMeta(id) {
  return get('SELECT * FROM documents WHERE id = ?', [id]);
}

async function listDocumentsBySession(sessionId) {
  return all('SELECT id, file_name, file_type, created_at, size_bytes FROM documents WHERE session_id = ? ORDER BY created_at DESC', [sessionId]);
}

async function deleteDocument(id) {
  const meta = await getDocumentMeta(id);
  if (!meta) return false;
  try {
    if (fs.existsSync(meta.storage_path)) fs.unlinkSync(meta.storage_path);
  } catch (e) {
    // log but continue to delete DB row
    console.warn('Failed to remove file from disk:', e);
  }
  await run('DELETE FROM documents WHERE id = ?', [id]);
  return true;
}

function streamDocumentFile(res, storagePath, fileName) {
  if (!fs.existsSync(storagePath)) {
    res.status(404).json({ error: 'file not found on disk' });
    return;
  }
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  const stream = fs.createReadStream(storagePath);
  stream.pipe(res);
}

module.exports = {
  storeFileFromBuffer,
  getDocumentMeta,
  listDocumentsBySession,
  deleteDocument,
  streamDocumentFile
};