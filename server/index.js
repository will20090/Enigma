"use strict";

require("dotenv").config();

var express = require("express");
var cors = require("cors");
var nodemailer = require("nodemailer");

var app = express();
var port = Number(process.env.PORT) || 3001;

var contactTo = process.env.CONTACT_TO || "enigma.codebusters@gmail.com";
var gmailUser = process.env.GMAIL_USER;
var gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

var allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(function (origin) { return origin.trim(); })
  .filter(Boolean);

app.use(express.json({ limit: "32kb" }));

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  }
}));

app.get("/health", function (_req, res) {
  res.json({ ok: true });
});

app.post("/api/contact", function (req, res) {
  if (!gmailUser || !gmailAppPassword) {
    res.status(503).json({ ok: false, error: "Mail service is not configured." });
    return;
  }

  var body = req.body || {};
  var name = String(body.name || "").trim();
  var email = String(body.email || "").trim();
  var subject = String(body.subject || "").trim();
  var message = String(body.message || "").trim();

  if (!name || !email || !message) {
    res.status(400).json({ ok: false, error: "Name, email, and message are required." });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: "Invalid email address." });
    return;
  }

  var mailSubject = subject
    ? "[Enigma Contact] " + subject
    : "[Enigma Contact] Message from " + name;

  var text =
    "Name: " + name + "\n" +
    "Email: " + email + "\n" +
    "Subject: " + (subject || "(none)") + "\n\n" +
    message;

  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword
    }
  });

  transporter.sendMail({
    from: "Enigma Contact <" + gmailUser + ">",
    to: contactTo,
    replyTo: name + " <" + email + ">",
    subject: mailSubject,
    text: text
  }).then(function () {
    res.json({ ok: true });
  }).catch(function (err) {
    console.error("[contact] send failed:", err);
    res.status(500).json({ ok: false, error: "Failed to send message." });
  });
});

app.listen(port, function () {
  console.log("Enigma contact API listening on port " + port);
});
