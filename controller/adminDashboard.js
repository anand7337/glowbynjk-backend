// routes/adminDashboard.js
const express = require("express");
const Order = require("../model/Order");
const Product = require("../model/product");
const User = require("../model/userLogin");
const Coupon = require("../model/Coupon");
const Blog = require("../model/blog");
const Gift = require("../model/GiftCard");

// GET /api/admin/dashboard
const adminDashboard =  async (req, res) => {
  try {
    // Total counts
    const orders = await Order.countDocuments();
    const products = await Product.countDocuments();
    const customers = await User.countDocuments();
    const coupons = await Coupon.countDocuments();
    const blogs = await Blog.countDocuments();
    const gift = await Gift.countDocuments();

    // Total revenue
    const revenueAgg = await Order.aggregate([
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
    ]);
    const revenue = revenueAgg[0]?.totalRevenue || 0;

    // Orders by status
    const ordersStatusArr = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const orderStatus = { Pending: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    ordersStatusArr.forEach((o) => { orderStatus[o._id] = o.count; });

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .select("orderNumber totalAmount status createdAt userId")
      .populate("userId", "email");

    const recentOrdersFormatted = recentOrders.map((o) => ({
      _id: o._id,
      orderNumber: o.orderNumber,
      totalAmount: o.totalAmount,
      status: o.status,
      createdAt: o.createdAt,
      userEmail: o.userId?.email || "Guest",
    }));

    // Orders trend (last 7 days)
    const today = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(today.getDate() - i);
      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));
      const ordersCount = await Order.countDocuments({
        createdAt: { $gte: dayStart, $lte: dayEnd },
      });
      last7Days.push({ day: dayStart.toLocaleDateString("en-US", { weekday: "short" }), orders: ordersCount });
    }

    // Revenue trend (last 7 days)
    const revenueTrend = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(today.getDate() - i);
      const dayStart = new Date(day.setHours(0, 0, 0, 0));
      const dayEnd = new Date(day.setHours(23, 59, 59, 999));
      const revenueDayAgg = await Order.aggregate([
        { $match: { createdAt: { $gte: dayStart, $lte: dayEnd } } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);
      revenueTrend.push({ day: dayStart.toLocaleDateString("en-US", { weekday: "short" }), revenue: revenueDayAgg[0]?.total || 0 });
    }

    res.json({
      orders,
      products,
      customers,
      coupons,
      blogs,
      gift,
      revenue,
      orderStatus,
      recentOrders: recentOrdersFormatted,
      ordersTrend: last7Days,
      revenueTrend,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {adminDashboard}