// File: utils/sendEmail.ts

import nodemailer from "nodemailer";

// Interface to define the options our function accepts
interface EmailOptions {
  email: string;
  subject: string;
  message: string; // The plain text content
  html?: string; // The optional HTML content
}

const sendEmail = async (options: EmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  // This is the object that will be sent to Nodemailer.
  // We ensure both 'text' and 'html' properties are included.
  const mailOptions: nodemailer.SendMailOptions = {
    from: `StoryNest <${process.env.SMTP_FROM}>`,
    to: options.email,
    subject: options.subject,
    text: options.message, // Sets the plain text part
    html: options.html, // Sets the HTML part
  };

  // ==> THE ULTIMATE PROOF <==
  // This will print the exact object being sent to Nodemailer in your server's terminal.
  console.log("--- Sending Email to Nodemailer ---");
  console.log(mailOptions);
  console.log("-----------------------------------");

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    // Re-throw the original error for better logging
    console.error("NODEMAILER ERROR:", err);
    throw err;
  }
};

export default sendEmail;
