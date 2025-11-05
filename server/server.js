// server.js (minimal)
import express from "express";
import Razorpay from "razorpay";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/create-order", async (req, res) => {
  try {
    const amountINR = req.body.amount || 100; // rupees
    const options = {
      amount: amountINR * 100, // convert to paise
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      payment_capture: 1, // 1 = auto-capture, 0 = manual capture
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to create order" });
  }
});
