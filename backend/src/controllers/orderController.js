// ────────────────────────────────────────────────────────────────
// src/controllers/orderController.js
// Read-only dashboard endpoints. The Next.js dashboard calls these to list
// orders by status and to open a single order's full detail.
// ────────────────────────────────────────────────────────────────

const { Order, ORDER_STATUS } = require('../models/Order');
const { sendWhatsAppMessage } = require('../whatsapp/sendMessage');
const logger = require('../utils/logger');

// Newest first — the dashboard wants the latest activity on top.
const SORT = { updatedAt: -1 };

/** GET /api/orders — all orders. */
async function getAllOrders(req, res, next) {
  try {
    const orders = await Order.find().sort(SORT);
    res.json(orders);
  } catch (err) {
    next(err);
  }
}

/** Helper to return orders filtered by a status. */
function listByStatus(status) {
  return async (req, res, next) => {
    try {
      const orders = await Order.find({ status }).sort(SORT);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  };
}

/** GET /api/orders/:id — a single order with its full message history. */
async function getOrderById(req, res, next) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    // Invalid ObjectId etc. → treat as not found rather than 500.
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Order not found' });
    }
    next(err);
  }
}

/** GET /api/orders/stats — counts for the dashboard top cards. */
async function getStats(req, res, next) {
  try {
    const [inquiry, confirmed, cancelled] = await Promise.all([
      Order.countDocuments({ status: ORDER_STATUS.INQUIRY }),
      Order.countDocuments({ status: ORDER_STATUS.CONFIRMED }),
      Order.countDocuments({ status: ORDER_STATUS.CANCELLED }),
    ]);
    res.json({ inquiry, confirmed, cancelled, total: inquiry + confirmed + cancelled });
  } catch (err) {
    next(err);
  }
}

// ── Manual seller controls ───────────────────────────────────────

/**
 * POST /api/orders/:id/message
 * Seller sends a manual WhatsApp message to this order's customer.
 * The message is stored in the chat history as sender="agent".
 * Body: { text: string }
 */
async function sendManualMessage(req, res, next) {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Message text is required' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Send over WhatsApp first; if Twilio rejects (e.g. outside the 24h window),
    // surface the error and DON'T store a message that never went out.
    try {
      await sendWhatsAppMessage(order.phoneNumber, text);
    } catch (err) {
      logger.error('Manual send failed:', err?.message || err);
      return res.status(502).json({
        error:
          'WhatsApp could not deliver this message. ' +
          (err?.message || '') +
          ' (Tip: outside the 24-hour window WhatsApp only allows template messages.)',
      });
    }

    order.messages.push({ sender: 'agent', messageType: 'text', message: text });
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orders/:id/status
 * Seller manually overrides the order status.
 * Body: { status: "INQUIRY" | "CONFIRMED" | "CANCELLED" }
 */
async function updateStatus(req, res, next) {
  try {
    const status = (req.body.status || '').toUpperCase();
    if (!Object.values(ORDER_STATUS).includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    await order.save();
    logger.info(`Order ${order._id} status manually set to ${status}`);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/orders/:id/auto-reply
 * Toggle auto-reply for this order's PHONE NUMBER (applies to all the
 * customer's orders so manual mode persists across orders).
 * Body: { enabled: boolean }
 */
async function setAutoReply(req, res, next) {
  try {
    const enabled = Boolean(req.body.enabled);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Sync the flag across every order for this number.
    await Order.updateMany(
      { phoneNumber: order.phoneNumber },
      { $set: { autoReplyEnabled: enabled } }
    );
    logger.info(`Auto-reply for ${order.phoneNumber} set to ${enabled}`);

    const updated = await Order.findById(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllOrders,
  getInquiries: listByStatus(ORDER_STATUS.INQUIRY),
  getConfirmed: listByStatus(ORDER_STATUS.CONFIRMED),
  getCancelled: listByStatus(ORDER_STATUS.CANCELLED),
  getOrderById,
  getStats,
  sendManualMessage,
  updateStatus,
  setAutoReply,
};
