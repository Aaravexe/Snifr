function notFound(root) {
  return (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ success: false, data: null, message: 'API route not found.' });
    }
    return res.status(404).sendFile('404.html', { root });
  };
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = error.status || (error.code === 'ENOENT' ? 404 : error.code === 11000 || error.name === 'VersionError' ? 409 : ['ValidationError','CastError','StrictModeError'].includes(error.name) ? 400 : 500);
  const message = status === 404 ? 'Requested resource was not found.' : status >= 500 ? 'Unexpected server error.' : error.code === 11000 ? 'A matching record already exists.' : error.message;
  if (status >= 500) console.error(error);
  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ success: false, data: null, message });
  }
  return res.status(status).type('text').send(message);
}

module.exports = { notFound, errorHandler };
