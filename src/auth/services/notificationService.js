import nodemailer from "nodemailer"
import logger from "../utils/logger.js"

class NotificationService {
  constructor() {
    this.emailTransporter = this.createEmailTransporter()
  }

  createEmailTransporter() {
    try {
      return nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || "gmail",
        auth: {
          user: process.env.EMAIL_USERNAME,
          pass: process.env.EMAIL_PASSWORD,
        },
      })
    } catch (error) {
      logger.error("Error creating email transporter:", error)
      return null
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(email, alert) {
    try {
      if (!this.emailTransporter) {
        throw new Error("Email service not configured")
      }

      const severityColors = {
        info: "#17a2b8",
        advisory: "#ffc107",
        watch: "#fd7e14",
        warning: "#dc3545",
        emergency: "#721c24",
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${severityColors[alert.severity]}; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${alert.title}</h1>
            <p style="margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase;">${alert.severity} Alert</p>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${alert.message}</p>
            
            ${
              alert.recommendedActions.length > 0
                ? `
              <h3 style="color: #333; margin-bottom: 15px;">Recommended Actions:</h3>
              <ul style="padding-left: 20px;">
                ${alert.recommendedActions
                  .map(
                    (action) => `
                  <li style="margin-bottom: 10px;">
                    <strong>${action.action}</strong>
                    <br>
                    <small style="color: #666;">
                      Priority: ${action.priority} | Timeframe: ${action.timeframe}
                      ${action.estimatedCost ? ` | Estimated Cost: $${action.estimatedCost}` : ""}
                    </small>
                  </li>
                `,
                  )
                  .join("")}
              </ul>
            `
                : ""
            }
            
            <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                <strong>Valid until:</strong> ${alert.validUntil.toLocaleString()}
                <br>
                <strong>Confidence:</strong> ${alert.confidence}%
              </p>
            </div>
          </div>
          
          <div style="padding: 15px; text-align: center; background-color: #343a40; color: white;">
            <p style="margin: 0; font-size: 12px;">
              ClyCites Agric Assistant - Weather Alert System
            </p>
          </div>
        </div>
      `

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
        to: email,
        subject: `🌦️ ${alert.severity.toUpperCase()}: ${alert.title}`,
        html: emailHtml,
      }

      await this.emailTransporter.sendMail(mailOptions)
      logger.info(`Weather alert email sent to ${email}`)
    } catch (error) {
      logger.error("Error sending email alert:", error)
      throw error
    }
  }

  /**
   * Send SMS alert (placeholder - integrate with SMS service)
   */
  async sendSMSAlert(phone, alert) {
    try {
      // Placeholder for SMS integration (Twilio, AWS SNS, etc.)
      const message = `${alert.severity.toUpperCase()}: ${alert.title}\n${alert.message}\nValid until: ${alert.validUntil.toLocaleString()}`

      logger.info(`SMS alert would be sent to ${phone}: ${message}`)

      // TODO: Integrate with actual SMS service
      // Example with Twilio:
      // await twilioClient.messages.create({
      //   body: message,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   to: phone
      // })
    } catch (error) {
      logger.error("Error sending SMS alert:", error)
      throw error
    }
  }

  /**
   * Send push notification (placeholder - integrate with push service)
   */
  async sendPushAlert(userId, alert) {
    try {
      // Placeholder for push notification integration (Firebase, OneSignal, etc.)
      const notification = {
        title: alert.title,
        body: alert.message,
        data: {
          alertId: alert._id.toString(),
          severity: alert.severity,
          alertType: alert.alertType,
        },
      }

      logger.info(`Push notification would be sent to user ${userId}:`, notification)

      // TODO: Integrate with actual push notification service
      // Example with Firebase:
      // await admin.messaging().sendToDevice(userToken, notification)
    } catch (error) {
      logger.error("Error sending push alert:", error)
      throw error
    }
  }

  /**
   * Send task reminder
   */
  async sendTaskReminder(user, task) {
    try {
      if (!this.emailTransporter || !user.email) {
        return
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #28a745; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Task Reminder</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 15px;">${task.title}</h2>
            <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">${task.description}</p>
            
            <div style="margin-bottom: 20px;">
              <p><strong>Priority:</strong> ${task.priority}</p>
              <p><strong>Category:</strong> ${task.category}</p>
              <p><strong>Estimated Duration:</strong> ${task.estimatedDuration.value} ${task.estimatedDuration.unit}</p>
              <p><strong>Due Date:</strong> ${task.taskDate.toLocaleDateString()}</p>
            </div>
            
            ${
              task.instructions.length > 0
                ? `
              <h3 style="color: #333; margin-bottom: 15px;">Instructions:</h3>
              <ol style="padding-left: 20px;">
                ${task.instructions
                  .map(
                    (instruction) => `
                  <li style="margin-bottom: 10px;">
                    ${instruction.description}
                    ${instruction.duration ? `<br><small style="color: #666;">Duration: ${instruction.duration} minutes</small>` : ""}
                  </li>
                `,
                  )
                  .join("")}
              </ol>
            `
                : ""
            }
          </div>
          
          <div style="padding: 15px; text-align: center; background-color: #343a40; color: white;">
            <p style="margin: 0; font-size: 12px;">
              ClyCites Agric Assistant - Task Management System
            </p>
          </div>
        </div>
      `

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
        to: user.email,
        subject: `📋 Task Reminder: ${task.title}`,
        html: emailHtml,
      }

      await this.emailTransporter.sendMail(mailOptions)
      logger.info(`Task reminder email sent to ${user.email}`)
    } catch (error) {
      logger.error("Error sending task reminder:", error)
      throw error
    }
  }

  /**
   * Send daily summary email
   */
  async sendDailySummaryEmail(user, dailySummary) {
    try {
      if (!this.emailTransporter || !user.email) {
        return
      }

      const { weather, tasks, recommendations, farmStatus } = dailySummary

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">Daily Farm Summary</h1>
            <p style="margin: 5px 0 0 0;">${dailySummary.date.toLocaleDateString()}</p>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 15px;">Weather Summary</h2>
            <p style="margin-bottom: 20px;">${weather.summary}</p>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Temperature</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${weather.current.temperature_2m}°C</p>
              </div>
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Humidity</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${weather.current.relative_humidity_2m}%</p>
              </div>
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Precipitation</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${weather.current.precipitation}mm</p>
              </div>
            </div>
            
            <h2 style="color: #333; margin-bottom: 15px;">Today's Tasks (${tasks.total})</h2>
            <div style="margin-bottom: 20px;">
              <p><span style="color: #dc3545;">●</span> Critical: ${tasks.byPriority.critical}</p>
              <p><span style="color: #fd7e14;">●</span> High: ${tasks.byPriority.high}</p>
              <p><span style="color: #ffc107;">●</span> Medium: ${tasks.byPriority.medium}</p>
              <p><span style="color: #28a745;">●</span> Low: ${tasks.byPriority.low}</p>
            </div>
            
            ${
              recommendations.length > 0
                ? `
              <h2 style="color: #333; margin-bottom: 15px;">Priority Recommendations</h2>
              <ul style="padding-left: 20px;">
                ${recommendations
                  .slice(0, 3)
                  .map(
                    (rec) => `
                  <li style="margin-bottom: 10px;">
                    <strong>${rec.action}</strong>
                    <br>
                    <small style="color: #666;">${rec.reason}</small>
                  </li>
                `,
                  )
                  .join("")}
              </ul>
            `
                : ""
            }
            
            <h2 style="color: #333; margin-bottom: 15px;">Farm Status</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Active Crops</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${farmStatus.activeCrops}</p>
              </div>
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Livestock Groups</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${farmStatus.activeLivestock}</p>
              </div>
              <div style="text-align: center;">
                <h4 style="margin: 0; color: #666;">Total Animals</h4>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${farmStatus.totalAnimals}</p>
              </div>
            </div>
            
            ${
              weather.alerts.length > 0
                ? `
              <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-top: 20px;">
                <h3 style="color: #856404; margin-top: 0;">Active Alerts (${weather.alerts.length})</h3>
                ${weather.alerts
                  .slice(0, 2)
                  .map(
                    (alert) => `
                  <p style="margin: 5px 0; color: #856404;">
                    <strong>${alert.title}</strong> - ${alert.severity}
                  </p>
                `,
                  )
                  .join("")}
              </div>
            `
                : ""
            }
          </div>
          
          <div style="padding: 15px; text-align: center; background-color: #343a40; color: white;">
            <p style="margin: 0; font-size: 12px;">
              ClyCites Agric Assistant - Daily Farm Management
            </p>
          </div>
        </div>
      `

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME,
        to: user.email,
        subject: `🌾 Daily Farm Summary - ${dailySummary.farm.name}`,
        html: emailHtml,
      }

      await this.emailTransporter.sendMail(mailOptions)
      logger.info(`Daily summary email sent to ${user.email}`)
    } catch (error) {
      logger.error("Error sending daily summary email:", error)
      throw error
    }
  }
}

export const notificationService = new NotificationService()
