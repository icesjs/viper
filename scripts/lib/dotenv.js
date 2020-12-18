const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { PROJECT_CONTEXT: cwd } = require('./utils')

function parseFile(filename) {
  const file = filename ? path.resolve(cwd, filename) : path.join(__dirname, '.env')
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
  return {
    ...parseFile(), // inner default
    ...parseFile('.env'),
    ...parseFile(`.env.${env}`),
  }
}
