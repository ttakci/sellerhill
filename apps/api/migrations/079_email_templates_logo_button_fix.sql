-- 078_email_templates_brand_refresh.sql was edited in place after it had
-- already been run once (with an earlier draft: a plain uppercase ".brand"
-- text label and a <style>-class-based button color) — an applied migration
-- never re-runs, so that earlier draft is what's still live: no logo mark,
-- and the "Verify" button renders with dark/default link text because Gmail
-- (and several other clients) strip <head><style> or override anchor color
-- with their own default link blue when the color isn't inlined on the <a>.
--
-- This re-applies 078's current (correct) content as its own migration so it
-- actually reaches the database: the inline SVG SellerHill mark (rounded
-- white badge + blue ascending bars, MSO fallback for Outlook) next to the
-- wordmark, and CTA buttons built with the bulletproof table+td[bgcolor]+a
-- pattern with color:#ffffff !important inlined directly on the anchor.

UPDATE email_templates
SET
  subject = 'Verify Your Email - SellerHill',
  html_content = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
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
      <h1>Verify your email</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Thank you for signing up for <strong>SellerHill</strong>! We''re excited to have you on board.<br><br>To get started, please verify your email address by clicking the button below:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{verificationUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">Verify Email Address</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Security note:</strong> This verification link will expire in 30 minutes for your security. If you didn''t create an account with SellerHill, you can safely ignore this email.</div>
      <div class="alternative-link">If the button doesn''t work, copy and paste this link:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
  updated_at = NOW()
WHERE template_key = 'email_verification' AND locale = 'en';

UPDATE email_templates
SET
  subject = 'E-postanızı Doğrulayın - SellerHill',
  html_content = '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-postanızı Doğrulayın</title>
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
      <h1>E-postanızı doğrulayın</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message"><strong>SellerHill</strong>''a kaydolduğunuz için teşekkür ederiz! Sizi aramızda görmekten mutluluk duyuyoruz.<br><br>Başlamak için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{verificationUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">E-posta Adresini Doğrula</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Güvenlik notu:</strong> Bu doğrulama bağlantısı güvenliğiniz için 30 dakika içinde geçerliliğini yitirecektir. Eğer SellerHill''da hesap oluşturmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.</div>
      <div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
  updated_at = NOW()
WHERE template_key = 'email_verification' AND locale = 'tr';

UPDATE email_templates
SET
  subject = 'Welcome to SellerHill!',
  html_content = '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SellerHill</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(37, 99, 235, 0.08); }
    .header { background: linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; }
    .content { padding: 40px 32px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .message { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .feature-list { margin: 28px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #eef2f7; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 22px; height: 22px; background-color: #10b981; color: #ffffff; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 12px; font-weight: bold; font-size: 12px; }
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
      <h1>Welcome to SellerHill</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Your email has been verified successfully! You''re now ready to start using <strong>SellerHill</strong> to sync your products between Amazon and eBay.</div>
      <ul class="feature-list">
        <li>Connect your eBay account securely via OAuth</li>
        <li>Sync products from Amazon to eBay automatically</li>
        <li>Manage multiple eBay stores from one dashboard</li>
        <li>Track inventory and pricing in real-time</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{dashboardUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">Go to Dashboard</a></td>
        </tr></table>
      </div>
      <div class="message">If you have any questions or need help getting started, feel free to reach out.<br><br>Happy selling!</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply.</div>
  </div>
</body>
</html>',
  updated_at = NOW()
WHERE template_key = 'welcome' AND locale = 'en';

UPDATE email_templates
SET
  subject = 'SellerHill''a Hoş Geldiniz!',
  html_content = '<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill''a Hoş Geldiniz</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(37, 99, 235, 0.08); }
    .header { background: linear-gradient(135deg, #4263EB 0%, #6366F1 50%, #818CF8 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; color: #ffffff; }
    .content { padding: 40px 32px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .message { font-size: 15px; color: #475569; margin-bottom: 28px; }
    .feature-list { margin: 28px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #eef2f7; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 22px; height: 22px; background-color: #10b981; color: #ffffff; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 12px; font-weight: bold; font-size: 12px; }
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
      <h1>SellerHill''a Hoş Geldiniz</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message">E-postanız başarıyla doğrulandı! Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için <strong>SellerHill</strong>''u kullanmaya başlayabilirsiniz.</div>
      <ul class="feature-list">
        <li>eBay hesabınızı OAuth ile güvenli şekilde bağlayın</li>
        <li>Amazon''dan eBay''e ürünleri otomatik olarak senkronize edin</li>
        <li>Tek bir kontrol panelinden birden fazla eBay mağazasını yönetin</li>
        <li>Stok ve fiyatları gerçek zamanlı olarak takip edin</li>
      </ul>
      <div style="text-align: center; margin: 32px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#2563eb" style="border-radius: 8px;"><a href="{{dashboardUrl}}" style="display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; border-radius: 8px;">Kontrol Paneline Git</a></td>
        </tr></table>
      </div>
      <div class="message">Herhangi bir sorunuz varsa veya yardıma ihtiyacınız olursa bizimle iletişime geçebilirsiniz.<br><br>İyi satışlar!</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın.</div>
  </div>
</body>
</html>',
  updated_at = NOW()
WHERE template_key = 'welcome' AND locale = 'tr';
