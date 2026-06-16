// ────────────────────────────────────────────────────────────────
// src/routes/orderRoutes.js
// Dashboard API routes (mounted under /api/orders in server.js).
//
// ORDER MATTERS: the specific paths (/inquiries, /confirmed, /cancelled,
// /stats) must be declared BEFORE the catch-all "/:id", otherwise Express
// would treat "inquiries" as an :id.
// ────────────────────────────────────────────────────────────────

const express = require('express');
const ctrl = require('../controllers/orderController');

const router = express.Router();

router.get('/', ctrl.getAllOrders);
router.get('/stats', ctrl.getStats);
router.get('/reorders', ctrl.getReorderCustomers);
router.get('/inquiries', ctrl.getInquiries);
router.get('/confirmed', ctrl.getConfirmed);
router.get('/delivered', ctrl.getDelivered);
router.get('/completed', ctrl.getCompleted);
router.get('/cancelled', ctrl.getCancelled);
router.get('/:id', ctrl.getOrderById);

// Manual seller controls
router.post('/:id/message', ctrl.sendManualMessage);
router.post('/:id/status', ctrl.updateStatus);
router.post('/:id/read', ctrl.markRead);
router.post('/:id/auto-reply', ctrl.setAutoReply);

module.exports = router;
