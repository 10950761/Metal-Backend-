const Notification = require('../models/Notification');

exports.getUnreadCount = async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    read: false
  });

  res.json({ count });
};