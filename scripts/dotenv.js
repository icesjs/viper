const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

function parseFile(filename) {
  const file = path.resolve(__dirname, `../${filename}`)
  if (fs.existsSync(file)) {
    return dotenv.parse(fs.readFileSync(file).toString('utf-8'))
  }
  return {}
}

module.exports = exports = function (...args) {
  return dotenv(...args)
}

exports.parse = dotenv.parse

exports.parseEnv = function parseEnv(env) {
  return Object.entries({ ...parseFile('.env'), ...parseFile(`.env.${env}`) }).reduce(
    (obj, [key, val]) => {
      obj[key] = val === 'false' ? false : val
      return obj
    },
    {}
  )
}
