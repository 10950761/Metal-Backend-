const nodemailer = require("nodemailer");

const sendSaleEmail = async (
  toEmail,
  productName,
  quantity,
  price,
  customerName,
  customerNumber,
  time,
  date
) => {
  const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: "metaltoolsproshop@gmail.com",
    to: toEmail,
    subject: "Sale Notification - Willin's Smart System",
    html: `<h3>Sale Confirmation</h3>
<p><strong>Product:</strong> ${productName}</p>
<p><strong>Quantity:</strong> ${quantity}</p>
<p><strong>Unit Price:</strong> GHS ${price}</p>
<p><strong>Customer:</strong> ${customerName || "N/A"} (${
    customerNumber || "N/A"
  })</p>
<p><strong>Time:</strong> ${time}, ${date}</p>
<p>Thank you for using our Smart System!</p>`,
  });
};

module.exports = sendSaleEmail;
