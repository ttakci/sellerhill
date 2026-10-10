-- apps/api/migrations/153_email_copy_review.sql
-- Copy review of the transactional e-mails and the buyer-message defaults
-- (operator request, 2026-10-10: no AI-style dashes, short natural sentences).
--
--   * Billing e-mails (107, 109) greeted twice ("Hi Ada," above "Hi Ada, the
--     payment ...") and the Turkish rows carried the English greeting and the
--     English footer. The greeting line stays, the message loses its copy of
--     it, and the Turkish rows get the Turkish greeting and footer.
--   * Em dashes go from subjects, bodies and footers.
--   * Turkish suffixes follow the brand's pronunciation (SellerHill'e /
--     SellerHill'i / SellerHill'de), as the app's own copy already does.
--
-- Every change is a replace() of an exact substring, so a template an
-- operator already edited by hand is left alone where the text differs.

-- 1. Footer, every template ------------------------------------------------

UPDATE email_templates
   SET html_content = replace(html_content,
         'Please do not reply — contact ',
         'Please do not reply. Contact '),
       updated_at = NOW()
 WHERE locale = 'en';

UPDATE email_templates
   SET html_content = replace(html_content,
         'Lütfen yanıtlamayın — yardım için ',
         'Lütfen yanıtlamayın. Yardım için '),
       updated_at = NOW()
 WHERE locale = 'tr';

-- The Turkish billing e-mails shipped with the English footer.
UPDATE email_templates
   SET html_content = replace(replace(replace(html_content,
         'SellerHill. All rights reserved.<br>',
         'SellerHill. Tüm hakları saklıdır.<br>'),
         'This is an automated email. Please do not reply — contact ',
         'Bu otomatik bir e-postadır. Lütfen yanıtlamayın. Yardım için '),
         'support@sellerhill.com</a> for help.',
         'support@sellerhill.com</a> adresine yazın.'),
       updated_at = NOW()
 WHERE locale = 'tr'
   AND template_key IN ('billing_payment_failed', 'billing_trial_ending', 'billing_price_change');

-- 2. Billing e-mails: one greeting, in the right language -------------------

UPDATE email_templates
   SET html_content = replace(html_content,
         '<div class="greeting">Hi {{firstName}},</div>',
         '<div class="greeting">Merhaba {{firstName}},</div>'),
       updated_at = NOW()
 WHERE locale = 'tr'
   AND template_key IN ('billing_payment_failed', 'billing_trial_ending', 'billing_price_change');

UPDATE email_templates
   SET subject = 'Payment failed: SellerHill automation is paused',
       html_content = replace(replace(html_content,
         '<div class="message">Hi {{firstName}}, the payment for your ',
         '<div class="message">The payment for your '),
         'Updating your card now is the fastest way to start everything again — automation resumes on its own as soon as the payment succeeds.',
         'Updating your card now is the fastest way to restart everything. Automation resumes on its own as soon as the payment goes through.'),
       updated_at = NOW()
 WHERE template_key = 'billing_payment_failed' AND locale = 'en';

UPDATE email_templates
   SET subject = 'Ödeme alınamadı, SellerHill otomasyonu durdu',
       html_content = replace(html_content,
         '<div class="message">Merhaba {{firstName}}, <strong>{{planName}}</strong>',
         '<div class="message"><strong>{{planName}}</strong>'),
       updated_at = NOW()
 WHERE template_key = 'billing_payment_failed' AND locale = 'tr';

UPDATE email_templates
   SET html_content = replace(replace(html_content,
         '<div class="message">Hi {{firstName}}, your free trial ends on ',
         '<div class="message">Your free trial ends on '),
         'Nothing is deleted if you do not — your listings and orders stay exactly as they are, automation simply stops.',
         'If you don''t, nothing is deleted. Your listings and orders stay as they are and only automation stops.'),
       updated_at = NOW()
 WHERE template_key = 'billing_trial_ending' AND locale = 'en';

UPDATE email_templates
   SET html_content = replace(html_content,
         '<div class="message">Merhaba {{firstName}}, ücretsiz denemeniz ',
         '<div class="message">Ücretsiz denemeniz '),
       updated_at = NOW()
 WHERE template_key = 'billing_trial_ending' AND locale = 'tr';

UPDATE email_templates
   SET html_content = replace(html_content,
         '<div class="message">Hi {{firstName}}, the price of your ',
         '<div class="message">The price of your '),
       updated_at = NOW()
 WHERE template_key = 'billing_price_change' AND locale = 'en';

UPDATE email_templates
   SET html_content = replace(html_content,
         '<div class="message">Merhaba {{firstName}}, <strong>{{planName}}</strong>',
         '<div class="message"><strong>{{planName}}</strong>'),
       updated_at = NOW()
 WHERE template_key = 'billing_price_change' AND locale = 'tr';

-- 3. Account e-mails --------------------------------------------------------

UPDATE email_templates
   SET subject = 'Verify your SellerHill email', updated_at = NOW()
 WHERE template_key = 'email_verification' AND locale = 'en'
   AND subject = 'Verify Your Email - SellerHill';

UPDATE email_templates
   SET subject = 'SellerHill e-postanızı doğrulayın', updated_at = NOW()
 WHERE template_key = 'email_verification' AND locale = 'tr'
   AND subject = 'E-postanızı Doğrulayın - SellerHill';

UPDATE email_templates
   SET subject = 'Reset your SellerHill password', updated_at = NOW()
 WHERE template_key = 'password_reset' AND locale = 'en'
   AND subject = 'Reset Your Password - SellerHill';

UPDATE email_templates
   SET subject = 'SellerHill şifrenizi sıfırlayın', updated_at = NOW()
 WHERE template_key = 'password_reset' AND locale = 'tr'
   AND subject = 'Şifrenizi Sıfırlayın - SellerHill';

UPDATE email_templates
   SET text_content = replace(text_content,
         'you can safely ignore this email — your password will not change.',
         'you can safely ignore this email.'),
       updated_at = NOW()
 WHERE template_key = 'password_reset' AND locale = 'en';

UPDATE email_templates
   SET text_content = replace(text_content,
         'bu e-postayı güvenle yoksayabilirsiniz — şifreniz değişmeyecektir.',
         'bu e-postayı güvenle yoksayabilirsiniz.'),
       updated_at = NOW()
 WHERE template_key = 'password_reset' AND locale = 'tr';

UPDATE email_templates
   SET subject = replace(subject, 'SellerHill''a', 'SellerHill''e'),
       html_content = replace(replace(html_content,
         'SellerHill''a Hoş Geldiniz', 'SellerHill''e Hoş Geldiniz'),
         '<strong>SellerHill</strong>''u kullanmaya', '<strong>SellerHill</strong>''i kullanmaya'),
       text_content = replace(text_content, 'SellerHill''u kullanmaya', 'SellerHill''i kullanmaya'),
       updated_at = NOW()
 WHERE template_key = 'welcome' AND locale = 'tr';

UPDATE email_templates
   SET html_content = replace(replace(html_content,
         '<strong>SellerHill</strong>''a kaydolduğunuz', '<strong>SellerHill</strong>''e kaydolduğunuz'),
         'Eğer SellerHill''da hesap oluşturmadıysanız, bu e-postayı',
         'SellerHill''de hesap oluşturmadıysanız bu e-postayı'),
       text_content = replace(text_content, 'SellerHill''a kaydolduğunuz', 'SellerHill''e kaydolduğunuz'),
       updated_at = NOW()
 WHERE template_key = 'email_verification' AND locale = 'tr';

-- 4. Daily summary: a sub-label that read as an unfinished sentence ---------

UPDATE email_templates
   SET html_content = replace(html_content,
         'Orders whose real Amazon cost is in</span>',
         'Orders with a confirmed Amazon cost</span>'),
       updated_at = NOW()
 WHERE template_key = 'daily_digest' AND locale = 'en';

UPDATE email_templates
   SET html_content = replace(html_content,
         'Gerçek Amazon maliyeti gelmiş siparişler</span>',
         'Amazon maliyeti kesinleşmiş siparişler</span>'),
       updated_at = NOW()
 WHERE template_key = 'daily_digest' AND locale = 'tr';

-- 5. Buyer message defaults: the shipped message ----------------------------
-- A seller's starter template that was never edited moves with the default,
-- as in migration 135; an edited one is the seller's own text and stays.

UPDATE buyer_message_templates t
   SET body = replace(t.body, 'Good news — your "{{item_title}}" is on its way!', 'Good news! Your "{{item_title}}" is on its way.'),
       updated_at = NOW()
  FROM buyer_message_system_defaults d
 WHERE t.is_default
   AND t.event_type = d.event_type
   AND t.body = d.body
   AND d.event_type = 'shipped';

UPDATE buyer_message_system_defaults
   SET body = replace(body, 'Good news — your "{{item_title}}" is on its way!', 'Good news! Your "{{item_title}}" is on its way.'),
       updated_at = NOW()
 WHERE event_type = 'shipped';
