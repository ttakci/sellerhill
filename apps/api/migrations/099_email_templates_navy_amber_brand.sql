-- 078/079 gave email_verification a blue/indigo gradient header with a fake
-- inline "bar chart" SVG standing in for a logo — never the real brand mark,
-- and not the app's actual navy/amber palette (colors.sidebar.background
-- #0c1f52 / the amber "HILL" accent #F59E0B). Operator caught this live
-- (2026-09-16): "hiç kurumsal değil, logomuz yok, renkler garip."
--
-- This replaces both locale rows with: the real SellerHill logo (hosted PNG,
-- apps/web/public/logo-email.png — SVG is not reliable in email clients,
-- notably desktop Outlook) on a solid navy header, an amber CTA button
-- (navy text, matching the landing page's $accent button), and several
-- accessibility fixes found against resend's email-best-practices skill:
-- `dir="ltr"` duplicated on both <html> and the body's direct child (several
-- clients strip it from <html>), a per-email <title> instead of the generic
-- one, and the muted gray (#94a3b8) used for the fallback link and footer
-- swapped for #64748b/#475569 — the old color read under the WCAG AA 4.5:1
-- text-contrast minimum. The footer also now names a real monitored inbox
-- (support@sellerhill.com) instead of a bare "please do not reply", per the
-- same skill's guidance against unmonitored transactional senders.
--
-- welcome / password_reset are intentionally NOT touched here — the operator
-- is reviewing email_verification first and will approve the rest
-- separately (a follow-up migration).

UPDATE email_templates
SET
  html_content = $HTML_EN$<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email for SellerHill</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #0c1f52; padding: 40px 32px 32px; text-align: center; }
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
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div lang="en" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Verify your email</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Thank you for signing up for <strong>SellerHill</strong>! We're excited to have you on board.<br><br>To get started, please verify your email address by clicking the button below:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{verificationUrl}}" class="btn">Verify Email Address</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Security note:</strong> This verification link will expire in 30 minutes for your security. If you didn't create an account with SellerHill, you can safely ignore this email.</div>
      <div class="alternative-link">If the button doesn't work, copy and paste this link:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>$HTML_EN$
WHERE template_key = 'email_verification' AND locale = 'en';

UPDATE email_templates
SET
  html_content = $HTML_TR$<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill için e-postanızı doğrulayın</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #0c1f52; padding: 40px 32px 32px; text-align: center; }
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
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div lang="tr" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>E-postanızı doğrulayın</h1>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message"><strong>SellerHill</strong>'a kaydolduğunuz için teşekkür ederiz! Sizi aramızda görmekten mutluluk duyuyoruz.<br><br>Başlamak için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın:</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{verificationUrl}}" class="btn">E-posta Adresini Doğrula</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Güvenlik notu:</strong> Bu doğrulama bağlantısı güvenliğiniz için 30 dakika içinde geçerliliğini yitirecektir. Eğer SellerHill'da hesap oluşturmadıysanız, bu e-postayı güvenle yoksayabilirsiniz.</div>
      <div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın — yardım için <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> ile iletişime geçin.</div>
  </div>
</body>
</html>$HTML_TR$
WHERE template_key = 'email_verification' AND locale = 'tr';
