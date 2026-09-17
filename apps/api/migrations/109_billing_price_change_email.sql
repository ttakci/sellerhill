-- Price-change notice e-mail (operator decision, 2026-09-17).
--
-- Sent by `pnpm --filter api billing:migrate-price` to each subscriber it moves
-- onto a plan's new price. The move itself never touches the period the seller
-- is in: the new price starts at their next renewal, and this e-mail tells them
-- the old price, the new price and that date first, with nothing for them to do
-- if they are happy to continue.
--
-- Same shell and branding as the other transactional templates. Variables:
-- {{firstName}}, {{planName}}, {{oldPrice}}, {{newPrice}}, {{effectiveDate}},
-- {{billingUrl}}, {{year}}.

DELETE FROM email_templates WHERE template_key = 'billing_price_change';

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_price_change', 'en', 'Your {{planName}} plan price is changing on {{effectiveDate}}', '<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your SellerHill plan price is changing</title>
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
      <h1>Your plan price is changing</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Hi {{firstName}}, the price of your <strong>{{planName}}</strong> plan is changing from <strong>{{oldPrice}}</strong> to <strong>{{newPrice}}</strong> per month. Your current billing period is not affected: the new price applies from your next renewal on <strong>{{effectiveDate}}</strong>.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">View billing</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Nothing to do if you want to continue:</strong> your plan, its limits and your automation stay exactly as they are. If you would rather switch to a different plan or cancel, you can do that from your billing page any time before {{effectiveDate}}.</div>
      <div class="alternative-link">Having trouble with the button? Open <a href="{{billingUrl}}">your billing page</a> instead.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","planName","oldPrice","newPrice","effectiveDate","billingUrl","year"]'::jsonb, TRUE);

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('billing_price_change', 'tr', '{{planName}} paketinizin fiyatı {{effectiveDate}} tarihinde değişiyor', '<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SellerHill paket fiyatınız değişiyor</title>
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
      <h1>Paket fiyatınız değişiyor</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Merhaba {{firstName}}, <strong>{{planName}}</strong> paketinizin aylık fiyatı <strong>{{oldPrice}}</strong> tutarından <strong>{{newPrice}}</strong> tutarına değişiyor. İçinde bulunduğunuz fatura dönemi etkilenmez; yeni fiyat <strong>{{effectiveDate}}</strong> tarihindeki bir sonraki yenilemenizden itibaren uygulanır.</div>
      <div class="button-container">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{billingUrl}}" class="btn">Faturalandırmayı gör</a></td>
        </tr></table>
      </div>
      <div class="security-note"><strong>Devam etmek için bir şey yapmanız gerekmiyor:</strong> paketiniz, limitleriniz ve otomasyonunuz olduğu gibi kalır. Başka bir pakete geçmek veya iptal etmek isterseniz {{effectiveDate}} tarihinden önce faturalandırma sayfanızdan yapabilirsiniz.</div>
      <div class="alternative-link">Butonla ilgili sorun mu yaşıyorsunuz? <a href="{{billingUrl}}">Faturalandırma sayfanızı</a> açabilirsiniz.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","planName","oldPrice","newPrice","effectiveDate","billingUrl","year"]'::jsonb, TRUE);
