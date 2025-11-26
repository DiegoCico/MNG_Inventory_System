import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { sesClient } from '../../src/aws';
import { sendInviteEmail } from '../../src/helpers/inviteEmail';

// Mock AWS SES client
jest.mock('../../src/aws', () => ({
  sesClient: {
    send: jest.fn(),
  },
}));

// Mock loadConfig
jest.mock('../../src/process', () => ({
  loadConfig: jest.fn(() => ({
    WEB_URL: 'https://test.example.com/signin',
    TABLE_NAME: 'test-table',
  })),
}));

// Get a reference to the mocked send function
const mockSesSend = sesClient.send as jest.Mock;

describe('inviteEmail', () => {
  const originalFromAddress = process.env.SES_FROM_ADDRESS;
  const originalConfigSet = process.env.SES_CONFIG_SET;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set a default successful response
    mockSesSend.mockResolvedValue({
      MessageId: 'default-message-id',
      $metadata: {},
    });
  });

  afterEach(() => {
    process.env.SES_FROM_ADDRESS = originalFromAddress;
    process.env.SES_CONFIG_SET = originalConfigSet;
  });

  describe('sendInviteEmail()', () => {
    it('sends email with correct parameters', async () => {
      const params = {
        to: 'newuser@example.com',
        tempPassword: 'TempPass123!',
        signinUrl: 'https://app.example.com/signin',
      };

      await sendInviteEmail(params);

      expect(mockSesSend).toHaveBeenCalledTimes(1);
      expect(mockSesSend).toHaveBeenCalledWith(expect.any(SendEmailCommand));
    });

    it('includes recipient email in Destination', async () => {
      const params = {
        to: 'recipient@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.Destination?.ToAddresses).toContain('recipient@example.com');
    });

    it('includes temporary password in email body', async () => {
      const params = {
        to: 'user@example.com',
        tempPassword: 'SecretTemp789',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      const textBody = command.input.Content?.Simple?.Body?.Text?.Data;
      const htmlBody = command.input.Content?.Simple?.Body?.Html?.Data;

      expect(textBody).toContain('SecretTemp789');
      expect(htmlBody).toContain('SecretTemp789');
    });

    it('includes sign-in URL from config in email', async () => {
      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      const textBody = command.input.Content?.Simple?.Body?.Text?.Data;
      const htmlBody = command.input.Content?.Simple?.Body?.Html?.Data;

      // Should use WEB_URL from config (mocked as https://test.example.com/signin)
      expect(textBody).toContain('https://test.example.com/signin');
      expect(htmlBody).toContain('https://test.example.com/signin');
    });

    it('uses default FROM address when SES_FROM_ADDRESS not set', async () => {
      delete process.env.SES_FROM_ADDRESS;

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.FromEmailAddress).toBe('cicotoste.d@northeastern.edu');
    });

    it('uses custom FROM address when SES_FROM_ADDRESS is set', async () => {
      process.env.SES_FROM_ADDRESS = 'custom@example.com';

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.FromEmailAddress).toBe('custom@example.com');
    });

    it('includes ConfigurationSetName when SES_CONFIG_SET is set', async () => {
      process.env.SES_CONFIG_SET = 'my-config-set';

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.ConfigurationSetName).toBe('my-config-set');
    });

    it('omits ConfigurationSetName when SES_CONFIG_SET not set', async () => {
      delete process.env.SES_CONFIG_SET;

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.ConfigurationSetName).toBeUndefined();
    });

    it('sets correct email subject', async () => {
      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      expect(command.input.Content?.Simple?.Subject?.Data).toBe(
        'Official Invitation – MNG Inventory Access',
      );
    });

    it('includes both text and HTML versions of email', async () => {
      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      const content = command.input.Content?.Simple;

      expect(content?.Body?.Text?.Data).toBeDefined();
      expect(content?.Body?.Html?.Data).toBeDefined();
    });

    it('HTML version contains proper structure', async () => {
      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      const command = mockSesSend.mock.calls[0][0] as SendEmailCommand;
      const htmlBody = command.input.Content?.Simple?.Body?.Html?.Data;

      expect(htmlBody).toContain('<div');
      expect(htmlBody).toContain('<table');
      expect(htmlBody).toContain('<a href=');
      expect(htmlBody).toContain('Sign In to MNG Inventory');
    });

    it('logs MessageId after successful send', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mockSesSend.mockResolvedValue({
        MessageId: 'msg-12345',
        $metadata: {},
      });

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await sendInviteEmail(params);

      expect(consoleSpy).toHaveBeenCalledWith('SES SendEmail MessageId:', 'msg-12345');

      consoleSpy.mockRestore();
    });

    it('throws error when SES send fails', async () => {
      mockSesSend.mockRejectedValue(new Error('SES Error'));

      const params = {
        to: 'user@example.com',
        tempPassword: 'Pass123',
        signinUrl: 'https://app.example.com',
      };

      await expect(sendInviteEmail(params)).rejects.toThrow('SES Error');
    });
  });
});
