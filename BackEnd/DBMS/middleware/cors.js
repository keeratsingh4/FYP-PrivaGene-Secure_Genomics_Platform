// middleware/cors.js
// CORS middleware to allow frontend to communicate with backend
// Supports both local development and production deployment

function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    // =====================================================
    // DEPLOYMENT: For production, you can restrict this to
    // your specific frontend domain for better security.
    // Example: const allowedOrigins = ['https://privagene.onrender.com'];
    // =====================================================
    
    // Allow all origins for flexibility (file://, localhost, and deployed domains)
    // In production, you may want to restrict this to specific domains
    const allowedOrigins = [
        'null',                              // file:// protocol
        'http://localhost:5500',             // VS Code Live Server
        'http://localhost:3000',             // Common dev port
        'http://127.0.0.1:5500',
        'http://127.0.0.1:3000',
    ];
    
    // Check if origin is in allowed list OR if it's a deployed domain
    // For deployment: allow any origin that includes your domain
    const isAllowed = !origin || 
                      origin === 'null' || 
                      origin.includes('localhost') || 
                      origin.includes('127.0.0.1') ||
                      origin.includes('onrender.com') ||     // Render.com domains
                      origin.includes('vercel.app') ||       // Vercel domains
                      origin.includes('netlify.app') ||      // Netlify domains
                      origin.includes('railway.app') ||      // Railway domains
                      origin.includes('github.io');          // GitHub Pages
    
    if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
        // For unknown origins, still allow but log it
        console.log('CORS: Unknown origin:', origin);
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Role, X-User-Id, X-Session-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
}

module.exports = corsMiddleware;
