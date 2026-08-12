CREATE OR REPLACE VIEW user_stats AS
SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(ea.id) as connected_ebay_accounts,
    u.created_at
FROM users u
LEFT JOIN ebay_accounts ea ON u.id = ea.user_id AND ea.status = 'active'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sellerhill_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sellerhill_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sellerhill_user;
