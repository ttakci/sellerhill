-- KEYS: readiness, rpm, user concurrency, provider concurrency, provider tokens
-- ARGV: now_ms, rpm_limit, user_concurrency_limit, provider_concurrency_limit,
--       rpm_ttl_ms, lease_id, lease_ttl_ms, requested_tokens, provider_token_limit
if redis.call('GET', KEYS[1]) ~= 'ready' then return {0, 6} end
local rpm = tonumber(redis.call('GET', KEYS[2]) or '0')
if rpm >= tonumber(ARGV[2]) then return {0, 1} end
local function prune(key)
  redis.call('ZREMRANGEBYSCORE', key, '-inf', ARGV[1])
  return tonumber(redis.call('ZCARD', key))
end
if prune(KEYS[3]) >= tonumber(ARGV[3]) then return {0, 2} end
if prune(KEYS[4]) >= tonumber(ARGV[4]) then return {0, 4} end
local requested = tonumber(ARGV[8])
local used = tonumber(redis.call('GET', KEYS[5]) or '0')
if requested > 0 and used + requested > tonumber(ARGV[9]) then return {0, 5} end
redis.call('INCR', KEYS[2]); redis.call('PEXPIRE', KEYS[2], ARGV[5])
local expiry = tonumber(ARGV[1]) + tonumber(ARGV[7])
redis.call('ZADD', KEYS[3], expiry, ARGV[6]); redis.call('PEXPIRE', KEYS[3], ARGV[7])
redis.call('ZADD', KEYS[4], expiry, ARGV[6]); redis.call('PEXPIRE', KEYS[4], ARGV[7])
if requested > 0 then redis.call('INCRBY', KEYS[5], requested); redis.call('PEXPIRE', KEYS[5], ARGV[5]) end
return {1, 0, expiry}
