const path = require('path')

exports.setMeta = (filePath, meta, proxy) => {
  switch (path.extname(filePath)) {
    case '.mp3':
      require('./mp3Meta')(filePath, meta, proxy)
      break
    case '.flac':
      require('./flacMeta')(filePath, meta, proxy)
      break
  }
}
