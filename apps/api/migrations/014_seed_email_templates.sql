INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'email_verification',
    'en',
    'Verify Your Email - SellerHill',
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
      <div class="message">Thank you for signing up for <strong>SellerHill</strong>! We''re excited to have you on board.<br><br>To get started, please verify your email address by clicking the button below:</div>
      <div class="button-container"><a href="{{verificationUrl}}" class="verify-button">Verify Email Address</a></div>
      <div class="security-note">⚠️ <strong>Security Note:</strong> This verification link will expire in 30 minutes for your security. If you didn''t create an account with SellerHill, you can safely ignore this email.</div>
      <div class="alternative-link">If the button doesn''t work, copy and paste this link:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
    'Hi {{firstName}},

Thank you for signing up for SellerHill!

Please verify your email by visiting this link:
{{verificationUrl}}

This link will expire in 30 minutes.

© {{year}} SellerHill. All rights reserved.',
    '["firstName", "verificationUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'email_verification',
    'tr',
    'E-postanızı Doğrulayın - SellerHill',
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
      <div class="message"><strong>SellerHill</strong>''a kaydolduğunuz için teşekkür ederiz! Sizi aramızda görmekten mutluluk duyuyoruz.<br><br>Başlamak için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın:</div>
      <div class="button-container"><a href="{{verificationUrl}}" class="verify-button">E-posta Adresini Doğrula</a></div>
      <div class="security-note">⚠️ <strong>Güvenlik Notu:</strong> Bu doğrulama bağlantısı güvenliğiniz için 30 dakika içinde geçerliliğini yitirecektir. Eğer SellerHill''da hesap oluşturmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.</div>
      <div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
    'Merhaba {{firstName}},

SellerHill''a kaydolduğunuz için teşekkür ederiz!

Lütfen e-postanızı bu bağlantıyı ziyaret ederek doğrulayın:
{{verificationUrl}}

Bu bağlantı 30 dakika içinde geçerliliğini yitirecektir.

© {{year}} SellerHill. Tüm hakları saklıdır.',
    '["firstName", "verificationUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'welcome',
    'en',
    'Welcome to SellerHill!',
    '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SellerHill</title>
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
    <div class="header"><h1>🎉 Welcome to SellerHill!</h1></div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Your email has been verified successfully! You''re now ready to start using <strong>SellerHill</strong> to sync your products between Amazon and eBay.</div>
      <ul class="feature-list">
        <li>Connect your eBay account securely via OAuth</li>
        <li>Sync products from Amazon to eBay automatically</li>
        <li>Manage multiple eBay stores from one dashboard</li>
        <li>Track inventory and pricing in real-time</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;"><a href="{{dashboardUrl}}" class="cta-button">Go to Dashboard</a></div>
      <div class="message">If you have any questions or need help getting started, feel free to reach out.<br><br>Happy selling! 🚀</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
    'Hi {{firstName}},

Your email has been verified successfully!

You''re now ready to start using SellerHill to sync your products between Amazon and eBay.

Visit your dashboard: {{dashboardUrl}}

Happy selling!

© {{year}} SellerHill. All rights reserved.',
    '["firstName", "dashboardUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;

INSERT INTO email_templates (template_key, locale, subject, html_content, text_content, variables)
VALUES (
    'welcome',
    'tr',
    'SellerHill''a Hoş Geldiniz!',
    '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill''a Hoş Geldiniz</title>
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
    <div class="header"><h1>🎉 SellerHill''a Hoş Geldiniz!</h1></div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message">E-postanız başarıyla doğrulandı! Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için <strong>SellerHill</strong>''u kullanmaya başlayabilirsiniz.</div>
      <ul class="feature-list">
        <li>eBay hesabınızı OAuth ile güvenli şekilde bağlayın</li>
        <li>Amazon''dan eBay''e ürünleri otomatik olarak senkronize edin</li>
        <li>Tek bir kontrol panelinden birden fazla eBay mağazasını yönetin</li>
        <li>Stok ve fiyatları gerçek zamanlı olarak takip edin</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;"><a href="{{dashboardUrl}}" class="cta-button">Kontrol Paneline Git</a></div>
      <div class="message">Herhangi bir sorunuz varsa veya yardıma ihtiyacınız olursa bizimle iletişime geçebilirsiniz.<br><br>İyi satışlar! 🚀</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
    'Merhaba {{firstName}},

E-postanız başarıyla doğrulandı!

Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için SellerHill''u kullanmaya başlayabilirsiniz.

Kontrol panelinizi ziyaret edin: {{dashboardUrl}}

İyi satışlar!

© {{year}} SellerHill. Tüm hakları saklıdır.',
    '["firstName", "dashboardUrl", "year"]'::jsonb
)
ON CONFLICT DO NOTHING;
