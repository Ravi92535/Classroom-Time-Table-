// Vercel serverless function - wraps Express app
require('dotenv').config({ path: '../backend/.env' });
const app = require('../backend/server.js');

// Export the Express app directly - Vercel will call it as a handler
module.exports = app;
