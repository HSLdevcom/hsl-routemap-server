const { get, last, clone } = require('lodash');
const AuthService = require('./authService');
const validator = require('validator');

const { GROUP_GENERATE, GROUP_READONLY } = require('../../constants');

const hasAllowedGroup = async (userInfo) => {
  const groups = get(userInfo, 'groups', {});

  if (!groups || !Array.isArray(groups)) {
    // LOGIN_DEBUG: raw groups value helps distinguish "missing claim" vs "wrong shape"
    console.log('[LOGIN_DEBUG] User does not have valid groups assigned', { groups });
    return false;
  }
  if (groups.includes(GROUP_GENERATE) || groups.includes(GROUP_READONLY)) {
    return true;
  }
  // LOGIN_DEBUG: log the groups vs. what's expected so mismatches are obvious
  console.log('[LOGIN_DEBUG] No allowed group match', {
    userGroups: groups,
    expectedGenerate: GROUP_GENERATE,
    expectedReadonly: GROUP_READONLY,
  });
  return false;
};

const authorize = async (req, res, session) => {
  const authRequest = req.body;
  const modifiedSession = clone(session);
  const { isTesting } = authRequest;

  // LOGIN_DEBUG: entry point trace for every /login call
  console.log('[LOGIN_DEBUG] authorize called', {
    hasSession: !!session,
    isTesting: !!isTesting,
    hasCode: !!authRequest.code,
  });

  if (modifiedSession && isTesting) {
    // When testing, code is already an access token (because tests fetched code with password grant request that gives you the correct access token)
    modifiedSession.accessToken = authRequest.code;
    const userInfo = await AuthService.requestUserInfo(authRequest.code);
    modifiedSession.email = userInfo.email;
    modifiedSession.groups = userInfo.groups;
    return {
      status: 200,
      body: {
        isOk: true,
        email: userInfo.email,
      },
      modifiedSession,
    };
  }

  if (!authRequest.code) {
    console.log('[LOGIN_DEBUG] 401: No authorization code in request body');
    return {
      body: {
        isOk: false,
      },
      status: 401,
    };
  }
  const tokenResponse = await AuthService.requestAccessToken(authRequest.code);

  if (session && tokenResponse.access_token) {
    modifiedSession.accessToken = tokenResponse.access_token;
    const userInfo = await AuthService.requestUserInfo(modifiedSession.accessToken);
    const isAllowed = await hasAllowedGroup(userInfo);
    if (!isAllowed) {
      console.log('[LOGIN_DEBUG] 401: No allowed group for user', { email: userInfo.email });
      return {
        status: 401,
        body: {
          isOk: false,
          message: 'No allowed group.',
        },
      };
    }

    modifiedSession.email = userInfo.email;
    modifiedSession.groups = userInfo.groups;

    const response = {
      isOk: true,
      email: userInfo.email,
    };

    return {
      status: 200,
      body: response,
      modifiedSession,
    };
  }
  console.log('[LOGIN_DEBUG] 401: No access token in token response', {
    hadSession: !!session,
    tokenResponse,
  });
  const response = {
    isOk: false,
  };
  return {
    status: 401,
    body: response,
  };
};

const checkExistingSession = async (req, res, session) => {
  if (session && session.accessToken) {
    const isAllowed = await hasAllowedGroup(session);
    if (!isAllowed) {
      await AuthService.logoutFromIdentityProvider(session.accessToken);
      return {
        status: 200,
      };
    }

    const response = {
      isOk: true,
      email: session.email,
      groups: session.groups,
    };
    return {
      status: 200,
      body: response,
    };
  }
  // console.log('No existing session');
  const response = {
    isOk: false,
  };
  return {
    status: 200,
    body: response,
  };
};

const logout = async (req, res, session) => {
  if (session && session.accessToken) {
    await AuthService.logoutFromIdentityProvider(session.accessToken);
    return {
      status: 200,
    };
  }
  return {
    status: 401,
  };
};

module.exports = {
  authorize,
  checkExistingSession,
  logout,
};
