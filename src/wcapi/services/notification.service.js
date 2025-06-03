import nodemailer from "nodemailer"
import twilio from "twilio"
import { logger } from "../utils/logger.js"

class NotificationService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number.parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // Initialize Twilio client
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    }
  }

  async sendEmail(userEmail, payload) {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || "noreply@agriweather.com",
        to: userEmail,
        subject: `[${payload.priority.toUpperCase()}] ${payload.title}`,
        html: this.generateEmailTemplate(payload),
      }

      await this.emailTransporter.sendMail(mailOptions)
      logger.info(`Email sent to ${userEmail}`)
      return true
    } catch (error) {
      logger.error("Error sending email:", error)
      return false
    }
  }

  async sendSMS(phoneNumber, payload) {
    if (!this.twilioClient || !phoneNumber) {
      logger.warn("SMS service not configured or no phone number provided")
      return false
    }

    try {
      const message = this.generateSMSMessage(payload)

      await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      })

      logger.info(`SMS sent to ${phoneNumber}`)
      return true
    } catch (error) {
      logger.error("Error sending SMS:", error)
      return false
    }
  }

  async sendPushNotification(userId, payload) {
    // Implement push notification logic here
    // This would typically integrate with Firebase Cloud Messaging or similar service
    logger.info(`Push notification would be sent to user ${userId}`)
    return true
  }

  generateEmailTemplate(payload) {
    const priorityColors = {
      low: "#28a745",
      medium: "#ffc107",
      high: "#fd7e14",
      urgent: "#dc3545",
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${payload.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${priorityColors[payload.priority]}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .priority-badge { 
            display: inline-block; 
            padding: 4px 8px; 
            background: ${priorityColors[payload.priority]}; 
            color: white; 
            border-radius: 4px; 
            font-size: 12px; 
            font-weight: bold; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${payload.title}</h1>
            <span class="priority-badge">${payload.priority.toUpperCase()}</span>
          </div>
          <div class="content">
            <p>${payload.message}</p>
            <p>This is a ${payload.type} notification with ${payload.priority} priority.</p>
            <p>Please check your AgriWeather dashboard for more details and recommendations.</p>
          </div>
          <div class="footer">
            <p>AgriWeather - Smart Farming Solutions</p>
            <p>You received this email because you have alerts enabled for your farm.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  generateSMSMessage(payload) {
    return `[${payload.priority.toUpperCase()}] ${payload.title}: ${payload.message}. Check AgriWeather app for details.`
  }

  // Localized message generation
  generateLocalizedMessage(payload, language) {
    const translations = this.getTranslations(language)

    return {
      ...payload,
      title: translations[payload.title] || payload.title,
      message: translations[payload.message] || payload.message,
    }
  }

  getTranslations(language) {
    const translations = {
      sw: {
        // Swahili
        "Frost warning": "Onyo la barafu",
        "Heat wave warning": "Onyo la joto kali",
        "Heavy rainfall expected": "Mvua kubwa inatarajiwa",
        "Irrigation needed": "Umwagiliaji unahitajika",
      },
      rw: {
        // Kinyarwanda
        "Frost warning": "Iburira ryo gukama",
        "Heat wave warning": "Iburira ry'ubushyuhe bukabije",
        "Heavy rainfall expected": "Imvura nyinshi iteganijwe",
        "Irrigation needed": "Guhira birakenewe",
      },
      lg: {
        // Luganda
        "Frost warning": "Okulabula kw'obutiti",
        "Heat wave warning": "Okulabula kw'ebbugumu",
        "Heavy rainfall expected": "Enkuba nnyingi esuubirwa",
        "Irrigation needed": "Okufukirira kwetaagisa",
      },
    }

    return translations[language] || {}
  }
}

export const notificationService = new NotificationService()
