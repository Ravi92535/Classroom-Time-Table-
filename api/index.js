// Vercel serverless handler
const app = require('../backend/server.js');

// Export as Vercel handler
module.exports = (req, res) => {
  return app(req, res);
};
