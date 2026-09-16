-- Applies the same rebrand approach already approved for email_verification
-- (migrations 099-101) to the remaining two transactional templates:
-- password_reset and welcome. Operator approved the verification design live
-- (2026-09-16: "beğendim diğer templateleri de güncelle") after reviewing a
-- rendered preview, per the staged rollout this project follows (verification
-- first, then apply the same pattern to the rest).
--
-- Both templates carried the SAME pre-rebrand design as verification did
-- before 099: a fake inline "bar chart" SVG standing in for the real logo, an
-- MSO/non-MSO conditional-comment split just to get SOME wordmark into
-- Outlook, a blue/indigo gradient (#4263EB/#6366F1/#818CF8 — landing's hero
-- text gradient, never the app's real navy/amber brand), and the same
-- accessibility gaps: no duplicated dir="ltr", a muted gray (#94a3b8) below
-- the WCAG AA 4.5:1 text-contrast minimum, a bare {{url}} shown as the
-- fallback link's visible text, and a footer that said "please do not reply"
-- with no monitored inbox to actually contact.
--
-- This migration replaces all four rows' html_content wholesale (same
-- technique as 099) with: the real hosted logo (apps/web/public/logo-email.png)
-- on the same gradient header as email_verification's final state (brand.primary
-- #2563eb -> brand.primaryHover #1d4ed8 -> landing.auroraBg #070B1A, the same
-- three tokens the login/register MeshBackground panel uses), the same amber
-- CTA button (#F59E0B fill, #0c1f52 text) so every transactional email now
-- shares one button language instead of three different button colors across
-- three templates, the same security-note treatment, the same short
-- descriptive fallback-link text pattern from migration 100, and the same
-- footer naming support@sellerhill.com. text_content (plain-text fallback) is
-- untouched on both templates — the wording didn't change, only the HTML
-- presentation layer.

UPDATE email_templates
SET
  html_content = $HTML_EN$<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password for SellerHill</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .security-note { margin-top: 28px; padding: 16px 18px; background-color: #fff8ec; border-left: 4px solid #F59E0B; font-size: 13px; color: #92400e; border-radius: 8px; line-height: 1.5; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #64748b; word-break: break-all; }
    .alternative-link a { color: #475569; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="en" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Reset your password</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">We received a request to reset the password for your <strong>SellerHill</strong> account. Click the button below to choose a new one:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{resetUrl}}" class="btn">Reset Password</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Security note:</strong> This link expires in 60 minutes and can be used once. If you didn't request a password reset, you can safely ignore this email — your password will not change.</div>
      <div class="alternative-link">Having trouble with the button? <a href="{{resetUrl}}">Reset your password</a> instead.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>$HTML_EN$
WHERE template_key = 'password_reset' AND locale = 'en';

UPDATE email_templates
SET
  html_content = $HTML_TR$<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill için şifrenizi sıfırlayın</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .security-note { margin-top: 28px; padding: 16px 18px; background-color: #fff8ec; border-left: 4px solid #F59E0B; font-size: 13px; color: #92400e; border-radius: 8px; line-height: 1.5; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #64748b; word-break: break-all; }
    .alternative-link a { color: #475569; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="tr" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Şifrenizi sıfırlayın</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message"><strong>SellerHill</strong> hesabınızın şifresini sıfırlama talebi aldık. Yeni bir şifre belirlemek için aşağıdaki butona tıklayın:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{resetUrl}}" class="btn">Şifreyi Sıfırla</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Güvenlik notu:</strong> Bu bağlantı 60 dakika içinde geçerliliğini yitirir ve yalnızca bir kez kullanılabilir. Şifre sıfırlama talebinde bulunmadıysanız bu e-postayı güvenle yoksayabilirsiniz — şifreniz değişmeyecektir.</div>
      <div class="alternative-link">Buton çalışmıyor mu? Bunun yerine <a href="{{resetUrl}}">şifrenizi sıfırlayın</a>.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın — yardım için <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> ile iletişime geçin.</div>
  </div>
</body>
</html>$HTML_TR$
WHERE template_key = 'password_reset' AND locale = 'tr';

UPDATE email_templates
SET
  html_content = $HTML_EN$<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SellerHill</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .feature-list { margin: 28px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #eef2f7; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 22px; height: 22px; background-color: #10b981; color: #ffffff; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 12px; font-weight: bold; font-size: 12px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #64748b; word-break: break-all; }
    .alternative-link a { color: #475569; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="en" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Welcome to SellerHill</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Your email has been verified successfully! You're now ready to start using <strong>SellerHill</strong> to sync your products between Amazon and eBay.</div>
      <ul class="feature-list">
        <li>Connect your eBay account securely via OAuth</li>
        <li>Sync products from Amazon to eBay automatically</li>
        <li>Manage multiple eBay stores from one dashboard</li>
        <li>Track inventory and pricing in real-time</li>
      </ul>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a></td>
        </tr></table>
      </div>
      <div class="alternative-link">Having trouble with the button? <a href="{{dashboardUrl}}">Go to your dashboard</a> instead.</div>
      <div class="message">If you have any questions or need help getting started, feel free to reach out.<br><br>Happy selling!</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>$HTML_EN$
WHERE template_key = 'welcome' AND locale = 'en';

UPDATE email_templates
SET
  html_content = $HTML_TR$<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill'a Hoş Geldiniz</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .feature-list { margin: 28px 0; padding: 0; list-style: none; }
    .feature-list li { padding: 12px 0; font-size: 14px; color: #475569; border-bottom: 1px solid #eef2f7; }
    .feature-list li:before { content: "✓"; display: inline-block; width: 22px; height: 22px; background-color: #10b981; color: #ffffff; border-radius: 50%; text-align: center; line-height: 22px; margin-right: 12px; font-weight: bold; font-size: 12px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .alternative-link { margin-top: 28px; padding-top: 20px; border-top: 1px solid #eef2f7; font-size: 13px; color: #64748b; word-break: break-all; }
    .alternative-link a { color: #475569; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="tr" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>SellerHill'a Hoş Geldiniz</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message">E-postanız başarıyla doğrulandı! Artık Amazon ve eBay arasında ürünlerinizi senkronize etmek için <strong>SellerHill</strong>'u kullanmaya başlayabilirsiniz.</div>
      <ul class="feature-list">
        <li>eBay hesabınızı OAuth ile güvenli şekilde bağlayın</li>
        <li>Amazon'dan eBay'e ürünleri otomatik olarak senkronize edin</li>
        <li>Tek bir kontrol panelinden birden fazla eBay mağazasını yönetin</li>
        <li>Stok ve fiyatları gerçek zamanlı olarak takip edin</li>
      </ul>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">Kontrol Paneline Git</a></td>
        </tr></table>
      </div>
      <div class="alternative-link">Buton çalışmıyor mu? Bunun yerine <a href="{{dashboardUrl}}">kontrol panelinize gidin</a>.</div>
      <div class="message">Herhangi bir sorunuz varsa veya yardıma ihtiyacınız olursa bizimle iletişime geçebilirsiniz.<br><br>İyi satışlar!</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın — yardım için <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> ile iletişime geçin.</div>
  </div>
</body>
</html>$HTML_TR$
WHERE template_key = 'welcome' AND locale = 'tr';
