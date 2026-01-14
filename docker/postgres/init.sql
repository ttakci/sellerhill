-- PostgreSQL Initialization Script
-- This script runs when the container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'pending',
    email_verification_token TEXT,
    email_verification_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create ebay_accounts table
CREATE TABLE IF NOT EXISTS ebay_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id VARCHAR(255) NOT NULL,
    marketplace_id VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    access_token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ebay_accounts
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_user_id ON ebay_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_seller_id ON ebay_accounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_marketplace ON ebay_accounts(marketplace_id);

-- Create unique constraint for seller_id + marketplace_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ebay_accounts_unique_seller_marketplace 
    ON ebay_accounts(seller_id, marketplace_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ebay_accounts_updated_at ON ebay_accounts;
CREATE TRIGGER update_ebay_accounts_updated_at
    BEFORE UPDATE ON ebay_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_key VARCHAR(100) NOT NULL,
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    subject VARCHAR(255) NOT NULL,
    html_content TEXT NOT NULL,
    text_content TEXT,
    variables JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for email_templates
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_locale ON email_templates(locale);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);

-- Create unique constraint for template_key + locale (only one active version per locale)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_unique_key_locale 
    ON email_templates(template_key, locale) WHERE is_active = TRUE;

-- Create trigger for email_templates
DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default email templates
-- Verification Email Template (English)
INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'email_verification',
    'en',
    'Verify Your Email - Zonds',
    '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #333333; }
    .message { font-size: 16px; color: #666666; margin-bottom: 30px; }
    .button-container { text-align: center; margin: 30px 0; }
    .verify-button { display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; }
    .security-note { margin-top: 30px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; font-size: 14px; color: #856404; border-radius: 4px; }
    .alternative-link { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 14px; color: #999999; word-break: break-all; }
    .footer { padding: 20px 30px; background-color: #f9f9f9; text-align: center; font-size: 12px; color: #999999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🚀 Verify Your Email</h1></div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Thank you for signing up for <strong>Zonds</strong>! We''re excited to have you on board.<br><br>To get started, please verify your email address by clicking the button below:</div>
      <div class="button-container"><a href="{{verificationUrl}}" class="verify-button">Verify Email Address</a></div>
      <div class="security-note">⚠️ <strong>Security Note:</strong> This verification link will expire in 30 minutes for your security. If you didn''t create an account with Zonds, you can safely ignore this email.</div>
      <div class="alternative-link">If the button doesn''t work, copy and paste this link:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} Zonds. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
    'Hi {{firstName}},

Thank you for signing up for Zonds!

Please verify your email by visiting this link:
{{verificationUrl}}

This link will expire in 30 minutes.

© {{year}} Zonds. All rights reserved.',
    '["firstName", "verificationUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Verification Email Template (Turkish)
INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'email_verification',
    'tr',
    'E-postanızı Doğrulayın - Zonds',
    '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-postanızı Doğrulayın</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .greeting { font-size: 18px; margin-bottom: 20px; color: #333333; }
    .message { font-size: 16px; color: #666666; margin-bottom: 30px; }
    .button-container { text-align: center; margin: 30px 0; }
    .verify-button { display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; }
    .security-note { margin-top: 30px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; font-size: 14px; color: #856404; border-radius: 4px; }
    .alternative-link { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 14px; color: #999999; word-break: break-all; }
    .footer { padding: 20px 30px; background-color: #f9f9f9; text-align: center; font-size: 12px; color: #999999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🚀 E-postanızı Doğrulayın</h1></div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message"><strong>Zonds</strong>''a kaydolduğunuz için teşekkür ederiz! Sizi aramızda görmekten mutluluk duyuyoruz.<br><br>Başlamak için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın:</div>
      <div class="button-container"><a href="{{verificationUrl}}" class="verify-button">E-posta Adresini Doğrula</a></div>
      <div class="security-note">⚠️ <strong>Güvenlik Notu:</strong> Bu doğrulama bağlantısı güvenliğiniz için 30 dakika içinde geçerliliğini yitirecektir. Eğer Zonds''da hesap oluşturmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.</div>
      <div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} Zonds. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
    'Merhaba {{firstName}},

Zonds''a kaydolduğunuz için teşekkür ederiz!

Lütfen e-postanızı bu bağlantıyı ziyaret ederek doğrulayın:
{{verificationUrl}}

Bu bağlantı 30 dakika içinde geçerliliğini yitirecektir.

© {{year}} Zonds. Tüm hakları saklıdır.',
    '["firstName", "verificationUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Welcome Email Template (English)
INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'welcome',
    'en',
    'Welcome to Zonds!',
    '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Zonds</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .message { font-size: 16px; color: #666666; margin-bottom: 30px; }
    .feature-list { margin: 30px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 15px; color: #555555; border-bottom: 1px solid #eeeeee; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 12px; font-weight: bold; }
    .cta-button { display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; }
    .footer { padding: 20px 30px; background-color: #f9f9f9; text-align: center; font-size: 12px; color: #999999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎉 Welcome to Zonds!</h1></div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Your email has been verified successfully! You''re now ready to start using <strong>Zonds</strong> to sync your products between Amazon and eBay.</div>
      <ul class="feature-list">
        <li>Connect your eBay account securely via OAuth</li>
        <li>Sync products from Amazon to eBay automatically</li>
        <li>Manage multiple eBay stores from one dashboard</li>
        <li>Track inventory and pricing in real-time</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;"><a href="{{dashboardUrl}}" class="cta-button">Go to Dashboard</a></div>
      <div class="message">If you have any questions or need help getting started, feel free to reach out.<br><br>Happy selling! 🚀</div>
    </div>
    <div class="footer">© {{year}} Zonds. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
    'Hi {{firstName}},

Your email has been verified successfully!

You''re now ready to start using Zonds to sync your products between Amazon and eBay.

Visit your dashboard: {{dashboardUrl}}

Happy selling!

© {{year}} Zonds. All rights reserved.',
    '["firstName", "dashboardUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

-- Welcome Email Template (Turkish)
INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'welcome',
    'tr',
    'Zonds''a Hoş Geldiniz!',
    '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zonds''a Hoş Geldiniz</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .message { font-size: 16px; color: #666666; margin-bottom: 30px; }
    .feature-list { margin: 30px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 15px; color: #555555; border-bottom: 1px solid #eeeeee; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; border-radius: 50%; text-align: center; line-height: 24px; margin-right: 12px; font-weight: bold; }
    .cta-button { display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; }
    .footer { padding: 20px 30px; background-color: #f9f9f9; text-align: center; font-size: 12px; color: #999999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🎉 Zonds''a Hoş Geldiniz!</h1></div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message">E-postanız başarıyla doğrulandı! Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için <strong>Zonds</strong>''u kullanmaya başlayabilirsiniz.</div>
      <ul class="feature-list">
        <li>eBay hesabınızı OAuth ile güvenli şekilde bağlayın</li>
        <li>Amazon''dan eBay''e ürünleri otomatik olarak senkronize edin</li>
        <li>Tek bir kontrol panelinden birden fazla eBay mağazasını yönetin</li>
        <li>Stok ve fiyatları gerçek zamanlı olarak takip edin</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;"><a href="{{dashboardUrl}}" class="cta-button">Kontrol Paneline Git</a></div>
      <div class="message">Herhangi bir sorunuz varsa veya yardıma ihtiyacınız olursa bizimle iletişime geçebilirsiniz.<br><br>İyi satışlar! 🚀</div>
    </div>
    <div class="footer">© {{year}} Zonds. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
    'Merhaba {{firstName}},

E-postanız başarıyla doğrulandı!

Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için Zonds''u kullanmaya başlayabilirsiniz.

Kontrol panelinizi ziyaret edin: {{dashboardUrl}}

İyi satışlar!

© {{year}} Zonds. Tüm hakları saklıdır.',
    '["firstName", "dashboardUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;


-- Insert a test user (password: Test123!)
-- Password hash for "Test123!" using bcrypt
INSERT INTO users (first_name, last_name, email, password_hash, email_verified)
VALUES (
    'Test',
    'User',
    'test@example.com',
    '$2b$10$rBV2JDeWW2y0gWvHhfS52eX.8.8bXKQP5FqZFqFvGqKzN5H5H5H5H5',
    true,
    'active'
)
ON CONFLICT (email) DO NOTHING;

-- Create a view for user stats (optional)
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(ea.id) as connected_ebay_accounts,
    u.created_at
FROM users u
LEFT JOIN ebay_accounts ea ON u.id = ea.user_id AND ea.status = 'active'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zonds_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zonds_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO zonds_user;
