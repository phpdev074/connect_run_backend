export function buildWelcomeEmail(pin: string): string {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6">
      <h2>Welcome to ConnectRun 🎉</h2>

      <p><strong>PIN:</strong> ${pin}</p>

      <p>Please note: This PIN will be used for check-in and check-out.</p>

      <p>Regards,<br/>Team ConnectRun Support</p>
    </div>
  `;
}

export function buildWelcomeMessage(name: string): string {
  return `
Hello ${name},

Welcome to ConnectRun 🎉

We’re excited to have you with us. Your account has been successfully created, and you can now start using ConnectRun.

If you have any questions, feel free to reach out to our support team.

Warm regards,
Team ConnectRun Support
  `.trim();
}
