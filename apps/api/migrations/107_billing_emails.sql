-- Billing e-mails: the two moments a seller has to hear about by e-mail
-- (operator decision, 2026-09-17).
--
-- The platform sent NO billing e-mail of any kind. A failed payment and an
-- expiring trial were visible only inside the app, on the Action Center and the
-- billing page — so the seller whose card had just been declined, and whose
-- automation had therefore stopped, found out the next time they happened to
-- log in. Both of these stop the product from working, and neither is something
-- a seller can be expected to discover on their own.
--
-- Deliberately only these two. Every other billing moment either carries no
-- action (a successful renewal — Stripe's own receipt covers it) or is already
-- visible where the seller is working (quota warnings in the Action Center). An
-- e-mail for every event trains people to ignore all of them.
--
-- Same shell, variables and branding as the existing transactional templates
-- (migration 092's password_reset): {{firstName}}, {{billingUrl}}, {{year}},
-- plus {{planName}} for the payment failure and {{daysLeft}}/{{trialEndDate}}
-- for the trial reminder. Turkish is written natively, not translated.

-- Re-seed cleanly: re-applying this file can never duplicate a row.
DELETE FROM email_templates WHERE template_key IN ('billing_payment_failed', 'billing_trial_ending');

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_payment_failed', 'en', 'Payment failed — SellerHill automation paused', '<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment failed for SellerHill</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
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
      <h1>We could not take your payment</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Hi {{firstName}}, the payment for your <strong>{{planName}}</strong> plan did not go through, so automation is paused: prices and stock are no longer synced, orders are not purchased automatically, and tracking is not sent to eBay. Your listings, orders and settings are untouched.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">Update payment method</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>What happens next:</strong> your bank is retried automatically over the coming days. Updating your card now is the fastest way to start everything again — automation resumes on its own as soon as the payment succeeds.</div>
      <div class="alternative-link">Having trouble with the button? Open <a href="{{billingUrl}}">your billing page</a> instead.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","planName","billingUrl","year"]'::jsonb, TRUE);

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_payment_failed', 'tr', 'Ödeme alınamadı — SellerHill otomasyonu durdu', '<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill ödemesi alınamadı</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
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
      <h1>Ödemenizi alamadık</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Merhaba {{firstName}}, <strong>{{planName}}</strong> paketinizin ödemesi geçmedi ve otomasyon durduruldu: fiyat ve stok güncellenmiyor, siparişler otomatik satın alınmıyor, kargo takibi eBay’e gönderilmiyor. İlanlarınız, siparişleriniz ve ayarlarınız olduğu gibi duruyor.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">Ödeme yöntemini güncelle</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Bundan sonra ne olacak:</strong> önümüzdeki günlerde ödeme otomatik olarak tekrar denenir. En hızlı yol kartınızı şimdi güncellemek; ödeme geçtiği anda otomasyon kendiliğinden kaldığı yerden devam eder.</div>
      <div class="alternative-link">Butonla ilgili sorun mu yaşıyorsunuz? <a href="{{billingUrl}}">Faturalandırma sayfanızı</a> açabilirsiniz.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","planName","billingUrl","year"]'::jsonb, TRUE);

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_trial_ending', 'en', 'Your SellerHill trial ends on {{trialEndDate}}', '<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SellerHill trial is ending</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
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
      <h1>Your trial ends in {{daysLeft}} days</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Hi {{firstName}}, your free trial ends on <strong>{{trialEndDate}}</strong>. Choose a plan before then to keep price and stock sync, automatic ordering and tracking updates running without a break. Nothing is deleted if you do not — your listings and orders stay exactly as they are, automation simply stops.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">Choose a plan</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Good to know:</strong> you can change or cancel your plan at any time, and your quota usage starts fresh with the new plan.</div>
      <div class="alternative-link">Having trouble with the button? Open <a href="{{billingUrl}}">your billing page</a> instead.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","daysLeft","trialEndDate","billingUrl","year"]'::jsonb, TRUE);

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_trial_ending', 'tr', 'SellerHill denemeniz {{trialEndDate}} tarihinde bitiyor', '<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill deneme süreniz bitiyor</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 560px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 40px 32px 32px; text-align: center; }
    .header img { display: block; margin: 0 auto 20px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .content { padding: 40px 36px; color: #27272a; line-height: 1.6; font-size: 16px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #27272a; }
    .message { font-size: 16px; color: #475569; margin-bottom: 28px; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; padding: 15px 40px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 16px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
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
      <h1>Denemenizin bitmesine {{daysLeft}} gün kaldı</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Merhaba {{firstName}}, ücretsiz denemeniz <strong>{{trialEndDate}}</strong> tarihinde sona eriyor. Fiyat ve stok takibi, otomatik sipariş ve kargo takibi kesintisiz devam etsin istiyorsanız o tarihe kadar bir paket seçin. Seçmezseniz hiçbir şey silinmez; ilanlarınız ve siparişleriniz olduğu gibi kalır, yalnızca otomasyon durur.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">Paket seç</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Bilginize:</strong> paketinizi dilediğiniz zaman değiştirebilir veya iptal edebilirsiniz; kota kullanımınız yeni paketle sıfırdan başlar.</div>
      <div class="alternative-link">Butonla ilgili sorun mu yaşıyorsunuz? <a href="{{billingUrl}}">Faturalandırma sayfanızı</a> açabilirsiniz.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","daysLeft","trialEndDate","billingUrl","year"]'::jsonb, TRUE);


-- One reminder per trial, ever. Without a stamp the daily job would re-send it
-- on every day of the reminder window, which is how an otherwise useful e-mail
-- becomes something people filter out.
ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
