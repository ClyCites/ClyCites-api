import nodemailer from "nodemailer"
import path from "path"
import { fileURLToPath } from "url"
import logger from "./logger.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create email transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === "production") {
    return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
    },
  })
  }

  // Development or Gmail
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
    },
  })
}

// Email templates
const emailTemplates = {
  emailVerification: {
    subject: "ClyCites - Verify Your Email Address",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ClyCites!</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Thank you for registering with ClyCites. To complete your registration, please verify your email address by clicking the button below:</p>
            <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
            <p>This verification link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create an account with ClyCites, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ClyCites. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  passwordReset: {
    subject: "ClyCites - Password Reset Request",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>We received a request to reset your password for your ClyCites account.</p>
            <a href="{{resetUrl}}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{resetUrl}}">{{resetUrl}}</a></p>
            <div class="warning">
              <strong>Important:</strong> This password reset link will expire in 10 minutes for security reasons.
            </div>
            <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ClyCites. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  welcome: {
    subject: "Welcome to ClyCites!",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ClyCites</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #059669; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .features { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ClyCites!</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Congratulations! Your email has been verified and your ClyCites account is now active.</p>
            <div class="features">
              <h3>What you can do now:</h3>
              <ul>
                <li>Complete your profile setup</li>
                <li>Explore the platform features</li>
                <li>Connect with other users</li>
                <li>Start creating and sharing content</li>
              </ul>
            </div>
            <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
            <p>If you have any questions or need help getting started, don't hesitate to contact our support team.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ClyCites. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
}

// Replace template variables
const replaceTemplateVariables = (template, data) => {
  let html = template
  Object.keys(data).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g")
    html = html.replace(regex, data[key])
  })
  return html
}

// Send email function
export const sendEmail = async (options) => {
  try {
    const transporter = createTransporter()

    // Get template
    const template = emailTemplates[options.template]
    if (!template) {
      throw new Error(`Email template '${options.template}' not found`)
    }

    // Replace template variables
    const html = replaceTemplateVariables(template.html, options.data || {})

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
      to: options.email,
      subject: options.subject || template.subject,
      html: html,
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)

    logger.info("Email sent successfully", {
      to: options.email,
      subject: mailOptions.subject,
      template: options.template,
      messageId: info.messageId,
    })

    return info
  } catch (error) {
    logger.error("Email sending failed", {
      to: options.email,
      template: options.template,
      error: error.message,
    })
    throw error
  }
}

// Send bulk emails
export const sendBulkEmail = async (emails) => {
  const results = []

  for (const emailOptions of emails) {
    try {
      const result = await sendEmail(emailOptions)
      results.push({ success: true, email: emailOptions.email, result })
    } catch (error) {
      results.push({ success: false, email: emailOptions.email, error: error.message })
    }
  }

  return results
}

// Verify email configuration
export const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter()
    await transporter.verify()
    logger.info("Email configuration verified successfully")
    return true
  } catch (error) {
    logger.error("Email configuration verification failed", { error: error.message })
    return false
  }
}
