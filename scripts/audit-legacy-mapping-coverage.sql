-- Coverage of speakasap-portal legacy users in legacy_identity_mappings.
-- Run read-only. Answers: is provisioning a fallback, or the main path?
SELECT
  status,
  COUNT(*)                                        AS rows,
  COUNT("authUserId")                             AS with_auth_user,
  COUNT(*) - COUNT("authUserId")                  AS missing_auth_user
FROM legacy_identity_mappings
WHERE "legacySystem" = 'speakasap-portal'
GROUP BY status
ORDER BY rows DESC;
