const nodeFetch = require('node-fetch');

const { CLIENT_ID, REDIRECT_URI, LOGIN_PROVIDER_URI, API_CLIENT_ID } = process.env;

const { CLIENT_SECRET, API_CLIENT_SECRET } = require('../../constants');

const authHash = Buffer.from(`${API_CLIENT_ID}:${API_CLIENT_SECRET}`).toString('base64');

const requestAccessToken = async (code) => {
  const url = `${LOGIN_PROVIDER_URI}/openid/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=${REDIRECT_URI}`;
  // LOGIN_DEBUG: log request params (excluding secrets) to help diagnose 401s from /login
  console.log('[LOGIN_DEBUG] requestAccessToken called', {
    loginProviderUri: LOGIN_PROVIDER_URI,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    hasCode: !!code,
    codeLength: code ? code.length : 0,
  });
  const response = await nodeFetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });
  const responseJson = await response.json();
  // LOGIN_DEBUG: log IdP response status/body so we can see why access_token might be missing
  console.log('[LOGIN_DEBUG] requestAccessToken response', {
    status: response.status,
    ok: response.ok,
    hasAccessToken: !!responseJson.access_token,
    error: responseJson.error,
    errorDescription: responseJson.error_description,
  });
  return responseJson;
};

const requestUserInfo = async (accessToken) => {
  const url = `${LOGIN_PROVIDER_URI}/openid/userinfo`;
  const response = await nodeFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const responseJson = await response.json();

  // LOGIN_DEBUG: log userinfo response (without leaking email/PII) to confirm groups claim shape
  console.log('[LOGIN_DEBUG] requestUserInfo response', {
    status: response.status,
    ok: response.ok,
    hasSub: !!responseJson.sub,
    emailVerified: responseJson.email_verified,
    groups: responseJson['https://oneportal.trivore.com/claims/groups'],
  });

  return {
    userId: responseJson.sub,
    email: responseJson.email,
    emailVerified: responseJson.email_verified,
    groups: responseJson['https://oneportal.trivore.com/claims/groups'],
  };
};

const logoutFromIdentityProvider = async (accessToken) => {
  const url = `${LOGIN_PROVIDER_URI}/openid/logout`;
  return nodeFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
};

const requestGroups = async () => {
  const url = `${LOGIN_PROVIDER_URI}/api/rest/v1/group`;
  const groupsResponse = await nodeFetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authHash}`,
    },
  });

  return groupsResponse.json();
};

const setGroup = async (userId, groupNames) => {
  const url = `${LOGIN_PROVIDER_URI}/api/rest/v1/user/${userId}`;
  const groups = await requestGroups();
  // const matchingSecrets = secrets.filter(secretFile => secretFile.startsWith(key));

  const groupIds = [];
  groups.resources.forEach((group) => {
    if (groupNames.includes(group.name)) {
      groupIds.push(group.id);
    }
  });
  const response = await nodeFetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHash}`,
    },
    body: JSON.stringify({
      memberOf: groupIds,
    }),
  });

  return response.json();
};

module.exports = { requestAccessToken, requestUserInfo, logoutFromIdentityProvider, setGroup };
