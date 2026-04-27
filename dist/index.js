"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("./middleware/auth");
// Setup environment and app
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Configure multer for file uploads
const uploadDisk = (0, multer_1.default)({ dest: 'uploads/' });
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Static files
app.use('/uploads', express_1.default.static(uploadsDir));
const upload = (0, multer_1.default)();
// Import controllers (we'll implement these)
const AuthController = __importStar(require("./controllers/auth"));
const LabController = __importStar(require("./controllers/lab"));
const ProgramController = __importStar(require("./controllers/program"));
const AdminController = __importStar(require("./controllers/admin"));
const DoctorController = __importStar(require("./controllers/doctor"));
const ReportController = __importStar(require("./controllers/report"));
const UserController = __importStar(require("./controllers/user"));
const ChatController = __importStar(require("./controllers/chat"));
const NotificationController = __importStar(require("./controllers/notification"));
const ConfigController = __importStar(require("./controllers/config"));
const AdController = __importStar(require("./controllers/ad"));
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
app.post('/api/lab/extract', auth_1.requireAuth, upload.single('file'), LabController.extractLab);
app.post('/api/lab/upload', auth_1.requireAuth, upload.single('file'), LabController.uploadLab);
app.post('/api/lab/manual', auth_1.requireAuth, LabController.saveManualLab);
app.get('/api/lab/results/latest', auth_1.requireAuth, LabController.getLatestLab);
app.get('/api/lab/results/:id', auth_1.requireAuth, LabController.getLabById);
// Program & Progress Routes
app.get('/api/program/detailed-logs', auth_1.requireAuth, ProgramController.getDetailedLogs);
app.get('/api/program/nutrition/search', auth_1.requireAuth, ProgramController.searchNutrition);
app.get('/api/program/:userId', auth_1.requireAuth, ProgramController.getActiveProgram);
app.post('/api/program/request', auth_1.requireAuth, ProgramController.requestProgram);
app.post('/api/program/cancel', auth_1.requireAuth, ProgramController.cancelProgramRequest);
app.post('/api/progress', auth_1.requireAuth, ProgramController.saveProgress);
app.post('/api/program/log/meal', auth_1.requireAuth, ProgramController.addMealLog);
app.delete('/api/program/log/meal/:id', auth_1.requireAuth, ProgramController.deleteMealLog);
app.post('/api/program/log/water', auth_1.requireAuth, ProgramController.addWaterLog);
app.delete('/api/program/log/water/:id', auth_1.requireAuth, ProgramController.deleteWaterLog);
app.post('/api/program/log/exercise', auth_1.requireAuth, ProgramController.addExerciseLog);
app.delete('/api/program/log/exercise/:id', auth_1.requireAuth, ProgramController.deleteExerciseLog);
app.post('/api/program/nutrition/scan', auth_1.requireAuth, uploadDisk.single('image'), ProgramController.scanFoodImage);
// User Profile Routes
app.get('/api/users/:userId/profile', auth_1.requireAuth, UserController.getProfile);
app.put('/api/users/:userId/profile', auth_1.requireAuth, UserController.updateProfile);
app.post('/api/users/:userId/change-password', auth_1.requireAuth, UserController.changePassword);
// Chat Routes
app.get('/api/chat/messages/:otherId', auth_1.requireAuth, ChatController.getMessages);
app.post('/api/chat/messages', auth_1.requireAuth, ChatController.sendMessage);
app.get('/api/chat/recent', auth_1.requireAuth, ChatController.getRecentChats);
// Notification Routes
app.get('/api/notifications', auth_1.requireAuth, NotificationController.getNotifications);
app.post('/api/notifications/:id/read', auth_1.requireAuth, NotificationController.markAsRead);
// Doctor Routes (For Patients)
app.get('/api/doctors', auth_1.requireAuth, DoctorController.getAllDoctors);
// ----------------------------------------------------
// Doctor-only Routes
// ----------------------------------------------------
app.get('/api/patients/:id', auth_1.requireAuth, (0, auth_1.requireRole)(['dokter']), DoctorController.getPatientDetails);
app.get('/api/lab-requests', auth_1.requireAuth, (0, auth_1.requireRole)(['dokter']), DoctorController.getLabRequests);
app.post('/api/lab-requests', auth_1.requireAuth, (0, auth_1.requireRole)(['dokter']), DoctorController.createLabRequest);
app.post('/api/programs', auth_1.requireAuth, (0, auth_1.requireRole)(['dokter', 'admin']), ProgramController.createProgram);
app.put('/api/programs', auth_1.requireAuth, (0, auth_1.requireRole)(['dokter', 'admin']), ProgramController.updateProgram);
app.get('/api/programs', auth_1.requireAuth, ProgramController.getProgramsList);
// ----------------------------------------------------
// Management & Admin Routes
// ----------------------------------------------------
app.get('/api/reports', auth_1.requireAuth, (0, auth_1.requireRole)(['admin', 'management']), ReportController.getReports);
app.get('/api/admin/companies', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.getCompanies);
app.post('/api/admin/companies', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.createCompany);
app.get('/api/admin/employees', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.getEmployees);
app.post('/api/admin/employees', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.createEmployee);
app.post('/api/admin/doctors', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.createDoctor);
app.put('/api/admin/doctors/:id', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdminController.updateDoctor);
app.get('/api/admin/smtp-settings', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), ConfigController.getSMTPSettings);
app.post('/api/admin/smtp-settings', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), ConfigController.saveSMTPSettings);
app.post('/api/admin/smtp-settings/test', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), ConfigController.testSMTPSettings);
app.post('/api/ui-configs', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), ConfigController.saveUIConfigs);
app.post('/api/admin/ads', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), upload.single('image'), AdController.createAd);
app.delete('/api/admin/ads/:id', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdController.deleteAd);
app.patch('/api/admin/ads/:id/status', auth_1.requireAuth, (0, auth_1.requireRole)(['admin']), AdController.toggleAdStatus);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
});
