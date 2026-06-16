// ────────────────────────────────────────────────────────────────
// src/controllers/orderController.js
// Read-only dashboard endpoints. The Next.js dashboard calls these to list
// orders by status and to open a single order's full detail.
// ────────────────────────────────────────────────────────────────

const { Order, ORDER_STATUS } = require('../models/Order');

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

module.exports = {
  getAllOrders,
  getInquiries: listByStatus(ORDER_STATUS.INQUIRY),
  getConfirmed: listByStatus(ORDER_STATUS.CONFIRMED),
  getCancelled: listByStatus(ORDER_STATUS.CANCELLED),
  getOrderById,
  getStats,
};
