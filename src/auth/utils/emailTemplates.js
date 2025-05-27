// Additional email templates for the new features

export const emailTemplates = {
  organizationInvite: {
    subject: "You've been invited to join {{organizationName}} on ClyCites",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          .role-badge { background: #e0e7ff; color: #4338ca; padding: 4px 12px; border-radius: 12px; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Organization Invitation</h1>
          </div>
          <div class="content">
            <h2>Hi there!</h2>
            <p><strong>{{inviterName}}</strong> has invited you to join <strong>{{organizationName}}</strong> on ClyCites.</p>
            
            <p>You've been assigned the role: <span class="role-badge">{{roleName}}</span></p>
            
            {{#if message}}
            <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Personal message:</strong></p>
              <p style="font-style: italic;">"{{message}}"</p>
            </div>
            {{/if}}
            
            {{#if isNewUser}}
            <p>Since this is your first time using ClyCites, you'll need to set up your account when you accept the invitation.</p>
            {{/if}}
            
            <a href="{{inviteUrl}}" class="button">Accept Invitation</a>
            
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="{{inviteUrl}}">{{inviteUrl}}</a></p>
            
            <p>This invitation will expire in 7 days for security reasons.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 ClyCites. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  teamInvite: {
    subject: "You've been added to {{teamName}} team",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Team Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 30px; background: #059669; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to the Team!</h1>
          </div>
          <div class="content">
            <h2>Hi {{userName}}!</h2>
            <p>You've been added to the <strong>{{teamName}}</strong> team in <strong>{{organizationName}}</strong>.</p>
            <p>Team Lead: <strong>{{teamLead}}</strong></p>
            <a href="{{teamUrl}}" class="button">View Team</a>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  apiTokenCreated: {
    subject: "New API Token Created - {{tokenName}}",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>API Token Created</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f9fafb; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>API Token Created</h1>
          </div>
          <div class="content">
            <h2>New API Token: {{tokenName}}</h2>
            <p>A new API token has been created for your account.</p>
            <p><strong>Organization:</strong> {{organizationName}}</p>
            <p><strong>Scopes:</strong> {{scopes}}</p>
            <p><strong>Expires:</strong> {{expiresAt}}</p>
            <div class="warning">
              <strong>Security Notice:</strong> If you didn't create this token, please contact your administrator immediately and revoke this token.
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
  },
}
