//
module.exports = {
  webpack: require('./config/craco.webpack'),
  babel: require('./config/craco.babel'),
  style: require('./config/craco.style'),
  plugins: [{ plugin: require('./scripts/lib/craco.plugin') }],
}
