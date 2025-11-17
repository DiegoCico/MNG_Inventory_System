import { SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-sesv2';
import { sesClient } from '../aws';

export const sendInviteEmail = async (params: {
  to: string;
  tempPassword: string;
  signinUrl: string;
}) => {
  const { to, tempPassword, signinUrl } = params;
  const URL_signin = 'https://d2cktegyq4qcfk.cloudfront.net/signin';

  const FROM = process.env.SES_FROM_ADDRESS || 'cicotoste.d@northeastern.edu';
  const CONFIG_SET = process.env.SES_CONFIG_SET;

  const subject = 'Official Invitation – MNG Inventory Access';

  const text = `Dear Team Member,

You have been officially invited to access the MNG Inventory System.

Login Credentials:
• Email: ${to}
• Temporary Password: ${tempPassword}

Please sign in using the link below:
${URL_signin}

Upon your first login, you will be prompted to create a new password for security purposes.

Respectfully,
MNG Inventory Support`;

  const html = `
<div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f7f9fc;padding:24px;color:#1b1f23;max-width:600px;margin:auto;border-radius:12px;border:1px solid #d0d7de;">
  <h2 style="text-align:center;color:#0b2e13;margin-bottom:16px;">Official Invitation – MNG Inventory Access</h2>

  <p style="font-size:15px;line-height:1.6;">Dear Team Member,</p>

  <p style="font-size:15px;line-height:1.6;">
    You have been officially invited to access the <strong>MNG Inventory System</strong>. Please use the credentials below to sign in for the first time:
  </p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:8px 0;font-weight:bold;">Email:</td>
      <td style="padding:8px 0;">${to}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;font-weight:bold;">Temporary Password:</td>
      <td style="padding:8px 0;"><code style="background:#eef2f7;padding:4px 8px;border-radius:6px;">${tempPassword}</code></td>
    </tr>
  </table>

  <p style="text-align:center;margin:24px 0;">
    <a href="${URL_signin}" target="_blank" rel="noopener noreferrer"
      style="background-color:#1d4ed8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
      Sign In to MNG Inventory
    </a>
  </p>

  <p style="font-size:14px;line-height:1.6;">
    Upon your first login, you will be prompted to create a new password for security purposes.
  </p>

  <hr style="margin:24px 0;border:none;border-top:1px solid #d0d7de;" />

  <p style="font-size:13px;color:#6b7280;text-align:center;">
    If you did not expect this invitation, please disregard this message.<br />
    <strong>MNG Inventory Support</strong>
  </p>
</div>`;

  const input: SendEmailCommandInput = {
    FromEmailAddress: FROM,
    Destination: { ToAddresses: [to] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Text: { Data: text }, Html: { Data: html } },
      },
    },
    ...(CONFIG_SET ? { ConfigurationSetName: CONFIG_SET } : {}),
  };

  const res = await sesClient.send(new SendEmailCommand(input));
  console.log('SES SendEmail MessageId:', res.MessageId);
};
