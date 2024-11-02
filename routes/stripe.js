const express = require("express");
const Stripe = require("stripe");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const stripe = Stripe(process.env.STRIPE_SECRET);

const router = express.Router();

const checkoutSuccessPage = fs.readFileSync(
    path.join(__dirname, 'checkout-success.html')
  );
  
  router.get("/checkout-success", (req, res) => {
    res.set("Content-Type", "text/html");
    res.send(checkoutSuccessPage);
  });

  const checkoutCancel = fs.readFileSync(
    path.join(__dirname, 'cancel.html')
  );
  
  router.get("/cancel", (req, res) => {
    res.set("Content-Type", "text/html");
    res.send(checkoutCancel);
  });


router.post("/create-checkout-session", async (req, res) => {
  const customer = await stripe.customers.create({
    metadata: {
      userId: req.body.userId,
      cart: JSON.stringify(req.body.cartItems),
    },
  });

 
  const line_items = req.body.cartItems.map((item) => {
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          description: `Payment for ${item.quantity} * ${item.name} from ${item.restaurantId}`,
          metadata: {
            id: item.id,
            restaurantId: item.restaurantId,
          },
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    };
  });
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
   
    
    phone_number_collection: {
      enabled: false,
    },
    line_items,
    mode: "payment",
    customer: customer.id,
    success_url: "https://eatseasy-payment-backend.vercel.app/stripe/checkout-success",
    cancel_url:  "https://eatseasy-payment-backend.vercel.app/stripe/cancel",
  });

  console.log(session.url);

  // res.redirect(303, session.url);
  res.send({ url: session.url });
});

router.post("/topup-wallet", async (req, res) => {
  const { userId, walletTransactions, walletBalance } = req.body;

  // Create a new customer if necessary
  const customer = await stripe.customers.create({
    metadata: {
      userId: userId,
    },
  });

  // Assuming walletTransactions is an array with at least one transaction
  if (!walletTransactions || walletTransactions.length === 0) {
    return res.status(400).send({ message: "No wallet transactions provided." });
  }

  // Create line items for each transaction in walletTransactions
  const line_items = walletTransactions.map(transaction => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: "Wallet Top-Up",
        description: `Top-up of $${transaction.amount} via ${transaction.paymentMethod}`,
        metadata: {
          userId: userId,
        },
      },
      unit_amount: transaction.amount * 100, // Amount in cents
    },
    quantity: 1,
  }));

  // Create a checkout session for the top-up
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items,
    mode: "payment",
    customer: customer.id,
    success_url: "https://eatseasy-payment-backend.vercel.app/stripe/v1/topups",
    cancel_url:  "https://eatseasy-payment-backend.vercel.app/stripe/cancel",
  });

  console.log("Top-up session URL:", session.url);

  // Respond with the checkout session URL
  res.send({ url: session.url });
});

module.exports = router;