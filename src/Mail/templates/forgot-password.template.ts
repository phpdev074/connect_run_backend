export function buildForgotPasswordEmail(link: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); padding: 30px 20px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 1px;">ConnectRun</h1>
      </div>
      <div style="padding: 40px 30px;">
        <h2 style="color: #333333; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #555555; font-size: 16px;">We received a request to reset your password for your <strong>ConnectRun</strong> account.</p>
        <p style="color: #555555; font-size: 16px;">Please click the button below to proceed. This link will safely direct you to reset your password:</p>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="${link}" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(238, 82, 83, 0.2);">Reset Password</a>
        </div>

        <p style="color: #777777; font-size: 14px;">If the button doesn't work, you can copy and paste the following link into your browser:</p>
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; word-break: break-all; margin-bottom: 20px;">
          <a href="${link}" style="color: #2a5298; font-size: 14px; text-decoration: none;">${link}</a>
        </div>
        
        <p style="color: #555555; font-size: 14px; margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 20px;">If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #555555; font-size: 14px;">Best Regards,<br/><strong>Team ConnectRun</strong></p>
      </div>
    </div>
  `;
}
