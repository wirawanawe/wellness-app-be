import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth, requireRole } from './middleware/auth';

// Setup environment and app
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const uploadDisk = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files
app.use('/uploads', express.static(uploadsDir));

const upload = multer();

// Import controllers (we'll implement these)
import * as AuthController from './controllers/auth';
import * as LabController from './controllers/lab';
import * as ProgramController from './controllers/program';
import * as AdminController from './controllers/admin';
import * as DoctorController from './controllers/doctor';
import * as ReportController from './controllers/report';
import * as UserController from './controllers/user';
import * as ChatController from './controllers/chat';
import * as NotificationController from './controllers/notification';
import * as ConfigController from './controllers/config';
import * as AdController from './controllers/ad';

// ----------------------------------------------------
// Public Routes
// ----------------------------------------------------
app.post('/api/auth/login', AuthController.login);
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/verify-otp', AuthController.verifyOTP);
app.get('/api/ui-configs/:app', ConfigController.getUIConfigs);
app.get('/api/ads', AdController.getAds);

// ----------------------------------------------------
// Protected Routes
// ----------------------------------------------------

// Lab Routes
app.post('/api/lab/extract', requireAuth, upload.single('file'), LabController.extractLab);
app.post('/api/lab/upload', requireAuth, upload.single('file'), LabController.uploadLab);
app.post('/api/lab/manual', requireAuth, LabController.saveManualLab);
app.get('/api/lab/results/latest', requireAuth, LabController.getLatestLab);
app.get('/api/lab/results/:id', requireAuth, LabController.getLabById);

// Program & Progress Routes
app.get('/api/program/detailed-logs', requireAuth, ProgramController.getDetailedLogs);
app.get('/api/program/nutrition/search', requireAuth, ProgramController.searchNutrition);
app.get('/api/program/:userId', requireAuth, ProgramController.getActiveProgram);
app.post('/api/program/request', requireAuth, ProgramController.requestProgram);
app.post('/api/program/cancel', requireAuth, ProgramController.cancelProgramRequest);
app.post('/api/progress', requireAuth, ProgramController.saveProgress);
app.post('/api/program/log/meal', requireAuth, ProgramController.addMealLog);
app.delete('/api/program/log/meal/:id', requireAuth, ProgramController.deleteMealLog);
app.post('/api/program/log/water', requireAuth, ProgramController.addWaterLog);
app.delete('/api/program/log/water/:id', requireAuth, ProgramController.deleteWaterLog);
app.post('/api/program/log/exercise', requireAuth, ProgramController.addExerciseLog);
app.delete('/api/program/log/exercise/:id', requireAuth, ProgramController.deleteExerciseLog);
app.post('/api/program/nutrition/scan', requireAuth, uploadDisk.single('image'), ProgramController.scanFoodImage);

// User Profile Routes
app.get('/api/users/:userId/profile', requireAuth, UserController.getProfile);
app.put('/api/users/:userId/profile', requireAuth, UserController.updateProfile);
app.post('/api/users/:userId/change-password', requireAuth, UserController.changePassword);

// WebAuthn
app.post('/api/webauthn/register-challenge', requireAuth, AuthController.getRegistrationOptions);
app.post('/api/webauthn/register-verify', requireAuth, AuthController.verifyRegistration);
app.post('/api/webauthn/login-challenge', AuthController.getAuthenticationOptions);
app.post('/api/webauthn/login-verify', AuthController.verifyAuthentication);

// PIN Security
app.post('/api/pin/setup', requireAuth, AuthController.setupPIN);
app.post('/api/pin/disable', requireAuth, AuthController.disablePIN);
app.get('/api/pin/check', AuthController.checkPINEnabled);
app.post('/api/pin/verify', AuthController.verifyPIN);



// Chat Routes
app.get('/api/chat/messages/:otherId', requireAuth, ChatController.getMessages);
app.post('/api/chat/messages', requireAuth, ChatController.sendMessage);
app.get('/api/chat/recent', requireAuth, ChatController.getRecentChats);

// Notification Routes
app.get('/api/notifications', requireAuth, NotificationController.getNotifications);
app.post('/api/notifications/:id/read', requireAuth, NotificationController.markAsRead);

// Doctor Routes (For Patients)
app.get('/api/doctors', requireAuth, DoctorController.getAllDoctors);

// ----------------------------------------------------
// Doctor-only Routes
// ----------------------------------------------------
app.get('/api/patients/:id', requireAuth, requireRole(['dokter']), DoctorController.getPatientDetails);
app.get('/api/lab-requests', requireAuth, requireRole(['dokter']), DoctorController.getLabRequests);
app.post('/api/lab-requests', requireAuth, requireRole(['dokter']), DoctorController.createLabRequest);
app.post('/api/programs', requireAuth, requireRole(['dokter', 'admin']), ProgramController.createProgram);
app.put('/api/programs', requireAuth, requireRole(['dokter', 'admin']), ProgramController.updateProgram);
app.get('/api/programs', requireAuth, ProgramController.getProgramsList);

// ----------------------------------------------------
// Management & Admin Routes
// ----------------------------------------------------
app.get('/api/reports', requireAuth, requireRole(['admin', 'management']), ReportController.getReports);

app.get('/api/admin/companies', requireAuth, requireRole(['admin']), AdminController.getCompanies);
app.post('/api/admin/companies', requireAuth, requireRole(['admin']), AdminController.createCompany);
app.get('/api/admin/employees', requireAuth, requireRole(['admin']), AdminController.getEmployees);
app.post('/api/admin/employees', requireAuth, requireRole(['admin']), AdminController.createEmployee);
app.post('/api/admin/doctors', requireAuth, requireRole(['admin']), AdminController.createDoctor);
app.put('/api/admin/doctors/:id', requireAuth, requireRole(['admin']), AdminController.updateDoctor);
app.get('/api/admin/smtp-settings', requireAuth, requireRole(['admin']), ConfigController.getSMTPSettings);
app.post('/api/admin/smtp-settings', requireAuth, requireRole(['admin']), ConfigController.saveSMTPSettings);
app.post('/api/admin/smtp-settings/test', requireAuth, requireRole(['admin']), ConfigController.testSMTPSettings);
app.post('/api/ui-configs', requireAuth, requireRole(['admin']), ConfigController.saveUIConfigs);
app.post('/api/admin/ads', requireAuth, requireRole(['admin']), upload.single('image'), AdController.createAd);
app.delete('/api/admin/ads/:id', requireAuth, requireRole(['admin']), AdController.deleteAd);
app.patch('/api/admin/ads/:id/status', requireAuth, requireRole(['admin']), AdController.toggleAdStatus);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[Backend] Server running on port ${PORT}`);
});
