// api/routes/admin.js

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const checkAccess = require('../middlewares/checkAccess');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Admin Dashboard Routes
 * Protected by: checkAccess (must be logged in and can_login = true)
 * Role-restricted: only 'admin' users
 */

// Middleware to ensure user is admin
function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admins only." });
  }
  next();
}

// --- Admin Dashboard Route (legacy; prefer GET /api/dashboard/stats) ---
router.get("/dashboard", checkAccess, isAdmin, async (req, res) => {
  try {
    const { getDashboardStats } = require('../services/dashboardStats');
    const { prisma: softDeletePrisma } = require('../prisma/prismaClient');
    const stats = await getDashboardStats(softDeletePrisma, { includeLeads: true });
    res.status(200).json(stats);
  } catch (error) {
    console.error("❌ Error fetching admin dashboard data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// --- Update User Access (enable/disable login) ---
router.put("/user/:id/access", checkAccess, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { can_login } = req.body;

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: { can_login },
    });

    res.status(200).json({
      message: `User ${updatedUser.username}'s access updated successfully`,
      updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user access:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// --- Delete a User ---
router.delete("/user/:id", checkAccess, isAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    await prisma.users.delete({ where: { id: userId } });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
