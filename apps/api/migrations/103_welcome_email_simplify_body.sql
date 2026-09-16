-- Operator feedback after seeing the rebranded welcome email live (2026-09-16,
-- screenshot of a real send): the four-item feature checklist and the closing
-- "if you have any questions, reach out" line are unnecessary. The header
-- already says "Welcome to SellerHill" and the footer already names
-- support@sellerhill.com, so listing product features here and repeating an
-- invitation to contact support both restate things the email already
-- establishes elsewhere. "ilk paragraf yeterli hoşgeldiniz diyelim kontrol
-- paneline git diyelim... buna da gerek yok zaten en altta support emaili
-- var" — the first paragraph is enough, then the dashboard button; the
-- closing contact line is redundant with the footer's support address.
--
-- Also worth noting from the operator's screenshot: the feature list's
-- checkmark bullets (CSS `:before { content: "✓" }` on <li>) did not render
-- at all in the live send — the icons are simply missing, just plain text
-- lines. Several major webmail clients (Gmail among them) strip `:before`/
-- `:after` generated content from sanitized HTML, so this was silently
-- degrading to an unbulleted list regardless. Removing the list sidesteps
-- that fragility entirely rather than trying to make it render everywhere.
--
-- Both locale rows keep the header/button/footer exactly as migration 102
-- left them (this is a body-only change): the greeting, the first message
-- paragraph, the CTA button and its fallback link are unchanged. Removed:
-- the <ul class="feature-list"> block (and its now-unused CSS), and the
-- trailing "If you have any questions..." / "Happy selling!" message.

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
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">Go to Dashboard</a></td>
        </tr></table>
      </div>
      <div class="alternative-link">Having trouble with the button? <a href="{{dashboardUrl}}">Go to your dashboard</a> instead.</div>
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
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">Kontrol Paneline Git</a></td>
        </tr></table>
      </div>
      <div class="alternative-link">Buton çalışmıyor mu? Bunun yerine <a href="{{dashboardUrl}}">kontrol panelinize gidin</a>.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın — yardım için <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> ile iletişime geçin.</div>
  </div>
</body>
</html>$HTML_TR$
WHERE template_key = 'welcome' AND locale = 'tr';
