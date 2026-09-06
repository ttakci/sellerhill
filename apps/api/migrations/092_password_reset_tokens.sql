-- Self-service password reset.
--
-- A random 256-bit token is emailed to the user; only its SHA-256 is stored
-- here, so a database read never yields a usable reset credential. Tokens are
-- single-use (consumed_at) with a short TTL (expires_at). One unconsumed row
-- per user at a time in practice — requesting a new link consumes the old ones
-- (AuthService.requestPasswordReset), and completing a reset consumes every
-- outstanding row for that user.
--
-- No FK-less design tricks needed: user_id references users(id) ON DELETE
-- CASCADE, which is correct — a deleted account has no password to reset.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,                 -- SHA-256 hex of the opaque token
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  consumed_at   TIMESTAMP WITH TIME ZONE,
  requested_ip  TEXT,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lookup path on reset: hash -> row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens (token_hash);

-- The cooldown check and "consume siblings" both scan a user's live tokens.
CREATE INDEX IF NOT EXISTS idx_prt_user_active
  ON password_reset_tokens (user_id) WHERE consumed_at IS NULL;


-- ---------------------------------------------------------------------------
-- password_reset email template (en + tr).
-- Same brand shell as 079's email_verification re-skin: inline SVG SellerHill
-- mark with an MSO "S" tile fallback, the bulletproof table+td[bgcolor]+a
-- button with color inlined on the anchor. Variables: firstName, resetUrl, year.
-- ---------------------------------------------------------------------------

INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
  'password_reset',
  'en',
  'Reset Your Password - SellerHill',
  '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(37, 99, 235, 0.08); }
    .header { background: linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; }
    .content { padding: 40px 32px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .security-note { margin-top: 28px; padding: 16px 18px; background-color: #fffbeb; border-left: 4px solid #d97706; font-size: 13px; color: #92400e; border-radius: 8px; line-height: 1.5; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #94a3b8; word-break: break-all; }
    .alternative-link a { color: #2563eb; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!--[if mso]>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px auto;"><tr>
      <td width="36" height="36" bgcolor="#ffffff" style="border-radius: 10px; text-align: center; vertical-align: middle; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #2563eb;">S</td>
      <td style="width: 10px; font-size: 1px; line-height: 1px;">&nbsp;</td>
      <td style="vertical-align: middle; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; color: #ffffff;">SellerHill</td>
      </tr></table>
      <![endif]-->
      <!--[if !mso]><!-->
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto;"><tr>
      <td style="vertical-align: middle; padding-right: 10px;"><svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SellerHill"><rect width="40" height="40" rx="10" fill="#ffffff"/><rect x="8" y="20" width="6" height="11" rx="1.6" fill="#2563eb"/><rect x="17" y="15" width="6" height="16" rx="1.6" fill="#2563eb"/><rect x="26" y="9" width="6" height="22" rx="1.6" fill="#2563eb"/></svg></td>
      <td style="vertical-align: middle;"><span style="font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">SellerHill</span></td>
      </tr></table>
      <!--<![endif]-->
      <h1>Reset your password</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">We received a request to reset the password for your <strong>SellerHill</strong> account. Click the button below to choose a new one:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{resetUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">Reset Password</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Security note:</strong> This link expires in 60 minutes and can be used once. If you didn''t request a password reset, you can safely ignore this email — your password will not change.</div>
      <div class="alternative-link">If the button doesn''t work, copy and paste this link:<br><a href="{{resetUrl}}">{{resetUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
  'Hi {{firstName}},

We received a request to reset the password for your SellerHill account.

Choose a new password using this link (expires in 60 minutes, single use):
{{resetUrl}}

If you didn''t request a password reset, you can safely ignore this email — your password will not change.

© {{year}} SellerHill. All rights reserved.',
  '["firstName", "resetUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
  'password_reset',
  'tr',
  'Şifrenizi Sıfırlayın - SellerHill',
  '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Şifrenizi Sıfırlayın</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(37, 99, 235, 0.08); }
    .header { background: linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; }
    .content { padding: 40px 32px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .security-note { margin-top: 28px; padding: 16px 18px; background-color: #fffbeb; border-left: 4px solid #d97706; font-size: 13px; color: #92400e; border-radius: 8px; line-height: 1.5; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #94a3b8; word-break: break-all; }
    .alternative-link a { color: #2563eb; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!--[if mso]>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px auto;"><tr>
      <td width="36" height="36" bgcolor="#ffffff" style="border-radius: 10px; text-align: center; vertical-align: middle; font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #2563eb;">S</td>
      <td style="width: 10px; font-size: 1px; line-height: 1px;">&nbsp;</td>
      <td style="vertical-align: middle; font-family: Arial, sans-serif; font-size: 20px; font-weight: bold; color: #ffffff;">SellerHill</td>
      </tr></table>
      <![endif]-->
      <!--[if !mso]><!-->
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 20px auto;"><tr>
      <td style="vertical-align: middle; padding-right: 10px;"><svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SellerHill"><rect width="40" height="40" rx="10" fill="#ffffff"/><rect x="8" y="20" width="6" height="11" rx="1.6" fill="#2563eb"/><rect x="17" y="15" width="6" height="16" rx="1.6" fill="#2563eb"/><rect x="26" y="9" width="6" height="22" rx="1.6" fill="#2563eb"/></svg></td>
      <td style="vertical-align: middle;"><span style="font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, sans-serif; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px;">SellerHill</span></td>
      </tr></table>
      <!--<![endif]-->
      <h1>Şifrenizi sıfırlayın</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message"><strong>SellerHill</strong> hesabınızın şifresini sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki butona tıklayın:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{resetUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">Şifreyi Sıfırla</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Güvenlik notu:</strong> Bu bağlantı 60 dakika içinde geçerliliğini yitirir ve yalnızca bir kez kullanılabilir. Şifre sıfırlama talebinde bulunmadıysanız bu e-postayı güvenle yoksayabilirsiniz — şifreniz değişmeyecektir.</div>
      <div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{resetUrl}}">{{resetUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
  'Merhaba {{firstName}},

SellerHill hesabınızın şifresini sıfırlama talebi aldık.

Yeni bir şifre belirlemek için bu bağlantıyı kullanın (60 dakika geçerli, tek kullanımlık):
{{resetUrl}}

Şifre sıfırlama talebinde bulunmadıysanız bu e-postayı güvenle yoksayabilirsiniz — şifreniz değişmeyecektir.

© {{year}} SellerHill. Tüm hakları saklıdır.',
  '["firstName", "resetUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;
