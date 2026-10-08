-- The seller's daily summary e-mail (operator decision, 2026-10-08; design:
-- docs/superpowers/specs/2026-10-08-daily-digest-email-design.md).
--
-- ONE e-mail per account per day, reporting the previous full day of the
-- seller's OWN calendar (users.timezone, migration 149), at a local hour the
-- seller picks between 05:00 and 12:00. On for everybody by default.
--
-- digest_last_sent_for is the day the last summary covered. The hourly tick
-- claims a user and stamps it in ONE statement, so a day can never be sent
-- twice; a failed send is not retried (a lost mail beats a duplicate).

ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_send_hour SMALLINT NOT NULL DEFAULT 8;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_last_sent_for DATE NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_digest_send_hour_range') THEN
    ALTER TABLE users ADD CONSTRAINT users_digest_send_hour_range
      CHECK (digest_send_hour BETWEEN 5 AND 12);
  END IF;
END $$;

COMMENT ON COLUMN users.digest_enabled IS 'Daily summary e-mail on/off (default on).';
COMMENT ON COLUMN users.digest_send_hour IS 'Local hour (users.timezone) the daily summary goes out, 5-12.';
COMMENT ON COLUMN users.digest_last_sent_for IS 'The local day the last daily summary covered (claim stamp).';

-- The rows are rendered in code (storesHtml, pendingHtml) and every value is
-- HTML-escaped before it is substituted. storesDisplay hides the per-store
-- table for an account with one store.
DELETE FROM email_templates WHERE template_key = 'daily_digest';

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('daily_digest', 'en', 'Your SellerHill summary for {{dayLabel}}', '<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your daily SellerHill summary</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 36px 32px 28px; text-align: center; }
    .header img { display: block; margin: 0 auto 18px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .header p { margin: 8px 0 0; font-size: 14px; color: #cbd5e1; }
    .content { padding: 32px 32px 36px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 8px; color: #27272a; }
    .message { font-size: 15px; color: #475569; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; color: #0c1f52; margin: 28px 0 10px; }
    .btn { display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .note { margin-top: 24px; font-size: 13px; color: #64748b; }
    .note a { color: #475569; }
    .footer { padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="en" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Your daily summary</h1>
      <p>{{dayLabel}}</p>
    </div>
    <div class="content">
      <div class="greeting">Hi {{firstName}},</div>
      <div class="message">Here is how yesterday went across your eBay stores, and what is waiting for you this morning.</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px;">
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Orders</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{orders}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Sales</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{sales}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Net profit<br><span style="font-size: 12px; color: #94a3b8;">Orders whose real Amazon cost is in</span></td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 18px; font-weight: 700; color: #047857;">{{netProfit}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Estimated profit<br><span style="font-size: 12px; color: #94a3b8;">Orders whose Amazon cost is not final yet</span></td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{estimatedProfit}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Orders cancelled</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{cancelledOrders}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">New cancellation requests</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{cancelRequests}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; font-size: 14px; color: #475569;">New returns</td>
          <td align="right" style="padding: 16px 18px; font-size: 16px; font-weight: 700; color: #27272a;">{{newReturns}}</td>
        </tr>
      </table>

      <div style="{{storesDisplay}}">
        <div class="section-title">By store</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Store</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Orders</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Sales</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Net profit</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Estimated</td>
          </tr>
          {{storesHtml}}
        </table>
      </div>

      <div class="section-title">Waiting for you</div>
      {{pendingHtml}}

      <div style="text-align: center; margin: 32px 0 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">Open SellerHill</a></td>
        </tr></table>
      </div>
      <div class="note">Figures cover yesterday in your own time zone and match your dashboard. Orders that are not linked to a SellerHill listing are not counted. You can change the sending time or turn this e-mail off in <a href="{{settingsUrl}}">your notification settings</a>.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. All rights reserved.<br>This is an automated email. Please do not reply — contact <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> for help.</div>
  </div>
</body>
</html>', '["firstName","dayLabel","orders","sales","netProfit","estimatedProfit","cancelledOrders","cancelRequests","newReturns","storesHtml","storesDisplay","pendingHtml","dashboardUrl","settingsUrl","year"]'::jsonb, TRUE);

INSERT INTO email_templates (template_key, locale, subject, html_content, variables, is_active)
VALUES ('daily_digest', 'tr', '{{dayLabel}} SellerHill özetiniz', '<!DOCTYPE html>
<html lang="tr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Günlük SellerHill özetiniz</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; background-color: #f4f5f7; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid rgba(12, 31, 82, 0.08); box-shadow: 0 8px 30px rgba(12, 31, 82, 0.10); }
    .header { background-color: #1d4ed8; background-image: linear-gradient(160deg, #2563eb 0%, #1d4ed8 45%, #070B1A 100%); border-radius: 16px 16px 0 0; padding: 36px 32px 28px; text-align: center; }
    .header img { display: block; margin: 0 auto 18px; height: 32px; width: auto; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #ffffff; letter-spacing: -0.2px; }
    .header p { margin: 8px 0 0; font-size: 14px; color: #cbd5e1; }
    .content { padding: 32px 32px 36px; color: #27272a; line-height: 1.6; font-size: 15px; }
    .greeting { font-size: 17px; font-weight: 600; margin-bottom: 8px; color: #27272a; }
    .message { font-size: 15px; color: #475569; margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; color: #0c1f52; margin: 28px 0 10px; }
    .btn { display: inline-block; padding: 14px 36px; font-family: -apple-system, ''Inter'', ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; font-size: 15px; font-weight: 700; color: #0c1f52 !important; text-decoration: none; border-radius: 10px; background-color: #F59E0B; }
    .note { margin-top: 24px; font-size: 13px; color: #64748b; }
    .note a { color: #475569; }
    .footer { padding: 22px 32px; background-color: #f8fafc; border-top: 1px solid #eef2f7; text-align: center; font-size: 12px; color: #64748b; border-radius: 0 0 16px 16px; }
  </style>
</head>
<body>
  <div lang="tr" dir="ltr" class="container">
    <div class="header">
      <img src="https://sellerhill.com/logo-email.png" alt="SellerHill" width="180">
      <h1>Günlük özetiniz</h1>
      <p>{{dayLabel}}</p>
    </div>
    <div class="content">
      <div class="greeting">Merhaba {{firstName}},</div>
      <div class="message">eBay mağazalarınızda dün neler olduğu ve bu sabah sizi neyin beklediği aşağıda.</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px;">
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Siparişler</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{orders}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Satışlar</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{sales}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Net kâr<br><span style="font-size: 12px; color: #94a3b8;">Gerçek Amazon maliyeti gelmiş siparişler</span></td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 18px; font-weight: 700; color: #047857;">{{netProfit}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Tahmini kâr<br><span style="font-size: 12px; color: #94a3b8;">Amazon maliyeti henüz kesinleşmemiş siparişler</span></td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{estimatedProfit}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">İptal edilen siparişler</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{cancelledOrders}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 14px; color: #475569;">Yeni iptal talepleri</td>
          <td align="right" style="padding: 16px 18px; border-bottom: 1px solid #eef2f7; font-size: 16px; font-weight: 700; color: #27272a;">{{cancelRequests}}</td>
        </tr>
        <tr>
          <td style="padding: 16px 18px; font-size: 14px; color: #475569;">Yeni iadeler</td>
          <td align="right" style="padding: 16px 18px; font-size: 16px; font-weight: 700; color: #27272a;">{{newReturns}}</td>
        </tr>
      </table>

      <div style="{{storesDisplay}}">
        <div class="section-title">Mağaza bazında</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Mağaza</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Sipariş</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Satış</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Net kâr</td>
            <td align="right" style="padding: 8px 6px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Tahmini</td>
          </tr>
          {{storesHtml}}
        </table>
      </div>

      <div class="section-title">Sizi bekleyenler</div>
      {{pendingHtml}}

      <div style="text-align: center; margin: 32px 0 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
          <td bgcolor="#F59E0B" style="border-radius: 10px;"><a href="{{dashboardUrl}}" class="btn">SellerHill''i aç</a></td>
        </tr></table>
      </div>
      <div class="note">Rakamlar kendi saat diliminize göre dünü kapsar ve panelinizle aynıdır. Bir SellerHill ilanına bağlı olmayan siparişler sayılmaz. Gönderim saatini değiştirmek veya bu e-postayı kapatmak için <a href="{{settingsUrl}}">bildirim ayarlarınıza</a> gidin.</div>
    </div>
    <div class="footer">© {{year}} SellerHill. Tüm hakları saklıdır.<br>Bu otomatik bir e-postadır. Lütfen yanıtlamayın — yardım için <a href="mailto:support@sellerhill.com" style="color:#475569;">support@sellerhill.com</a> adresine yazın.</div>
  </div>
</body>
</html>', '["firstName","dayLabel","orders","sales","netProfit","estimatedProfit","cancelledOrders","cancelRequests","newReturns","storesHtml","storesDisplay","pendingHtml","dashboardUrl","settingsUrl","year"]'::jsonb, TRUE);
