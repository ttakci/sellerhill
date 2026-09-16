-- 099 kept the "if the button doesn't work" fallback as the raw
-- {{verificationUrl}} printed out as the link's visible text — the operator
-- flagged it as ugly (a long wrapped URL) and the email-best-practices skill
-- flags it as an accessibility violation independently ("never use a bare
-- URL as link text — screen reader users navigate by link text alone").
-- The link itself is unchanged (same href, still fully copyable via
-- right-click), only the VISIBLE text changes to a short, descriptive
-- phrase matching the button's own wording.

UPDATE email_templates
SET
  html_content = replace(
    html_content,
    '<div class="alternative-link">If the button doesn''t work, copy and paste this link:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>',
    '<div class="alternative-link">Having trouble with the button? <a href="{{verificationUrl}}">Verify your email</a> instead.</div>'
  )
WHERE template_key = 'email_verification' AND locale = 'en';

UPDATE email_templates
SET
  html_content = replace(
    html_content,
    '<div class="alternative-link">Buton çalışmıyorsa, bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br><a href="{{verificationUrl}}">{{verificationUrl}}</a></div>',
    '<div class="alternative-link">Buton çalışmıyor mu? Bunun yerine <a href="{{verificationUrl}}">e-postanızı doğrulayın</a>.</div>'
  )
WHERE template_key = 'email_verification' AND locale = 'tr';
