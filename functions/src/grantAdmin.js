/**
 * Grant (or revoke) Firebase Auth custom claim: admin = true
 * Callable: grantAdminAccess({ email, secret?, revoke? })
 *
 * First admin (bootstrap): set Functions secret ADMIN_BOOTSTRAP_SECRET
 * and pass the same secret in the request.
 * Later: any caller who already has claim admin:true can grant others.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getAuth } = require('firebase-admin/auth');
const { defineSecret } = require('firebase-functions/params');

const bootstrapSecret = defineSecret('ADMIN_BOOTSTRAP_SECRET');

exports.grantAdminAccess = onCall(
  {
    region: 'asia-south1',
    secrets: [bootstrapSecret],
  },
  async (request) => {
    const email = String(request.data?.email || '')
      .trim()
      .toLowerCase();
    const revoke = Boolean(request.data?.revoke);
    const providedSecret = String(request.data?.secret || '');

    if (!email || !email.includes('@')) {
      throw new HttpsError('invalid-argument', 'Pass a valid email.');
    }

    const caller = request.auth;
    const callerIsAdmin = caller?.token?.admin === true;
    const bootstrapOk =
      providedSecret.length > 0 &&
      providedSecret === bootstrapSecret.value();

    if (!callerIsAdmin && !bootstrapOk) {
      throw new HttpsError(
        'permission-denied',
        'Need existing admin claim or valid ADMIN_BOOTSTRAP_SECRET.'
      );
    }

    try {
      const user = await getAuth().getUserByEmail(email);
      const nextClaims = { ...(user.customClaims || {}) };
      if (revoke) {
        delete nextClaims.admin;
      } else {
        nextClaims.admin = true;
      }
      await getAuth().setCustomUserClaims(user.uid, nextClaims);

      return {
        success: true,
        uid: user.uid,
        email: user.email,
        admin: !revoke,
        message: revoke
          ? `Removed admin claim from ${email}. User must sign out/in.`
          : `Granted admin:true to ${email}. User must sign out and sign in again.`,
      };
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        throw new HttpsError(
          'not-found',
          `No Firebase Auth user for ${email}. Create the account first (Sign up / Email login), then grant admin.`
        );
      }
      console.error('[grantAdminAccess]', err);
      throw new HttpsError('internal', err.message || 'Failed to set claim');
    }
  }
);
