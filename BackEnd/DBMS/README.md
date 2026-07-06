PrivaGene Backend - SQLite + Local File Storage (Drop-in)

Requirements:
- Node.js 16+ installed
- No internet/cloud required after dependencies are installed

Setup (for lecturer / grader):
1. Open terminal in the backend/ folder
2. Run:
   npm install
3. Run migrations (optional; server will auto-run migrations on start):
   npm run migrate
4. Start server:
   npm start
   (server listens on http://localhost:3001 by default)

Notes:
- The SQLite DB is created at backend/app.db
- Uploaded files are stored under backend/storage/analysis_results/
- Roles are supplied with the HTTP header X-Role (patient/doctor/researcher/admin)
- Session linkage is required via X-Session-ID header or session_id form field

Sample requests (curl):

## User Management APIs

Register new user:
curl -v -X POST "http://localhost:3001/api/users/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.com","password":"test123","role":"patient","firstName":"John","lastName":"Doe","phone":"1234567890"}'

Login user:
curl -v -X POST "http://localhost:3001/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@test.com","password":"test123"}'

Get user by ID:
curl -v -X GET "http://localhost:3001/api/users/<USER_ID>"

Update user profile:
curl -v -X PUT "http://localhost:3001/api/users/<USER_ID>" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","phone":"0987654321"}'

List all users:
curl -v -X GET "http://localhost:3001/api/users"

List users by role:
curl -v -X GET "http://localhost:3001/api/users?role=patient"

Update user status (admin only):
curl -v -X PATCH "http://localhost:3001/api/users/<USER_ID>/status" \
  -H "X-Role: admin" \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'

Delete user:
curl -v -X DELETE "http://localhost:3001/api/users/<USER_ID>"

## Document Management APIs

Upload (multipart form):
curl -v -X POST "http://localhost:3001/api/documents/upload" \
  -H "X-Role: patient" \
  -H "X-Session-ID: session-abc-123" \
  -F "file=@/path/to/result.pdf"

List documents for a session:
curl -v -X GET "http://localhost:3001/api/documents?session_id=session-abc-123" \
  -H "X-Role: doctor"

Download by id:
curl -v -X GET "http://localhost:3001/api/documents/<DOC_ID>/download" \
  -H "X-Role: doctor" \
  -H "X-Session-ID: session-abc-123" \
  -o downloaded.pdf

Delete (admin only):
curl -v -X DELETE "http://localhost:3001/api/documents/<DOC_ID>" \
  -H "X-Role: admin"

Security & Later integration:
- The current header-based role check is a placeholder for grading/submission simplicity.
  Replace middleware/auth.js with your real authentication (JWT, sessions, etc.) when integrating.
- The database stores only metadata and file paths. No patient identifiers should be passed in session_id.
- All paths are relative to the backend/ folder so the ZIP remains portable.

Role Mapping (Frontend → Backend):
- Frontend roles: patient, doctor, hospital_admin, researcher, system_admin
- Backend expects: patient, doctor, admin, researcher
- The middleware automatically maps hospital_admin → admin and system_admin → admin

Frontend Integration:
The frontend uses the BackendAPI service (front end/js/api-backend.js) to communicate with this backend.

Files updated for integration:
- config.js - Backend URL configuration
- api-backend.js - API service layer for document operations
- api-mock.js - Enhanced to upload risk assessments to backend automatically
- storage.js - Added getCurrentUser() and updateRiskAssessment() methods

How the frontend calls the backend:
1. After PSI risk computation, the frontend automatically creates JSON and CSV files
2. These files are uploaded to the backend via BackendAPI.uploadRiskAssessment()
3. The session ID is generated as: assessment_${userId}_${assessmentId}
4. Doctor/Researcher portals can later retrieve these documents by session ID

Example frontend usage:
```javascript
// Upload a document
const result = await BackendAPI.uploadRiskAssessment(file, userId, assessmentId);

// List documents for a session
const docs = await BackendAPI.listRiskAssessments(sessionId);

// Download a document
await BackendAPI.triggerDownload(docId, fileName, sessionId);

// Delete a document (admin only)
await BackendAPI.deleteRiskAssessment(docId);
```

Supported File Types:
The backend accepts all file types (not limited to PDF/CSV). The following are explicitly supported:
- Documents: PDF, CSV, TXT, JSON, HTML
- Genetic Data: VCF, FASTA, FASTQ  
- Spreadsheets: XLSX, XLS
- Word Documents: DOC, DOCX
Maximum file size: 50 MB

Testing Integration:
1. Start backend: npm start
2. Open frontend: pages/index.html
3. Login as patient
4. Compute risk assessment
5. Check browser console for "Document uploaded successfully"
6. Check backend/storage/analysis_results/ for saved files
7. Check app.db for document metadata

For detailed integration instructions, see: /INTEGRATION_GUIDE.md