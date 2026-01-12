const User = require('../models/User.model');

/**
 * Resolve a single canonical user identity.
 * Priority:
 * 1. Linked Google account (authProviders.google.googleId)
 * 2. Email address (globally unique)
 * 3. xID (optionally firm-scoped)
 *
 * Always returns the MongoDB _id as the canonical identity.
 * Optionally links Google account to an existing user when allowed.
 */
const resolveUserIdentity = async ({
  googleProfile,
  xid,
  email,
  firmId,
  session,
  canLinkGoogle,
  linkGoogleIfFound = false,
} = {}) => {
  const normalizedEmail = email ? email.toLowerCase().trim() : null;
  const normalizedXid = xid ? xid.trim().toUpperCase() : null;
  const googleId = googleProfile?.sub || googleProfile?.googleId || null;

  let user = null;
  let linkedDuringRequest = false;
  const withSession = session ? { session } : undefined;
  const updateOptions = { new: true, ...(withSession || {}) };

  if (googleId) {
    user = await User.findOne({ 'authProviders.google.googleId': googleId }, null, withSession);
  }

  if (!user && normalizedEmail) {
    const candidate = await User.findOne({ email: normalizedEmail }, null, withSession);
    if (candidate) {
      const allowLink = typeof canLinkGoogle === 'function'
        ? canLinkGoogle(candidate)
        : linkGoogleIfFound;

      if (googleId && allowLink) {
        const alreadyLinked = await User.findOne({ 'authProviders.google.googleId': googleId }, null, withSession);
        if (alreadyLinked && alreadyLinked._id.toString() !== candidate._id.toString()) {
          throw new Error('Google account is already linked to another user');
        }

        const updated = await User.findOneAndUpdate(
          { 
            _id: candidate._id, 
            $or: [
              { 'authProviders.google.googleId': { $exists: false } },
              { 'authProviders.google.googleId': null },
            ],
          },
          {
            $set: {
              'authProviders.google.googleId': googleId,
              'authProviders.google.linkedAt': new Date(),
            },
          },
          updateOptions
        );
        if (updated) {
          linkedDuringRequest = true;
          user = updated;
        }
      }
      if (!user) {
        user = candidate;
      }
    }
  }

  if (!user && normalizedXid) {
    const query = { xID: normalizedXid };
    if (firmId) {
      query.firmId = firmId;
    }
    user = await User.findOne(query, null, withSession);
  }

  if (!user) {
    return { user: null, linkedDuringRequest: false };
  }

  return {
    user,
    linkedDuringRequest,
    userId: user._id.toString(),
  };
};

module.exports = { resolveUserIdentity };
