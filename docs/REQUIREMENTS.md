# Requirements — where-is-my-model

## Task: Remove Email Verification Feature

### Context
The user wants to completely remove the email verification functionality from the project. No SMTP server will be used, so this feature is unnecessary.

### Critical constraints
1. **Everything else must continue working perfectly**: JWT auth, httpOnly cookies, refresh tokens, 2FA, rate limiting, Helmet, SSRF protection, audit logging, request IDs, password validation, etc. — all must remain intact.
2. **User registration and login must work without email verification**.
3. The role system (admin/user/pending) and the pending approval flow must be preserved.
4. If the User model has fields like `isVerified`, evaluate whether to remove them or keep as optional.

### Scope of removal
| Item | Action |
|------|--------|
| `backend/routes/verify.js` | Delete file entirely |
| `backend/services/emailService.js` | Delete if only used for email verification |
| References in `backend/server.js` | Remove verify route registration |
| References in `backend/routes/auth.js` | Remove any email-sending logic during registration |
| User model fields `isVerified`, `emailVerificationToken`, etc. | Evaluate and clean up |
| Frontend components/UI for email verification | Remove |
| `nodemailer` dependency in `backend/package.json` | Remove if no longer used |

### Expected outcome
- Clean, working app after `docker compose up --build`
- Registration → user created with role (admin for first, pending for subsequent) → no email sent, no verification needed
- All other features untouched and operational
