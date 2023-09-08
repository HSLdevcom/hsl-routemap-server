import busIcon from 'icons/icon_bus.svg';
import tramIcon from 'icons/icon_tram.svg';
import lRailIcon from 'icons/icon_lrail.svg';
import railIcon from 'icons/icon_rail.svg';
import subwayIcon from 'icons/icon_subway.svg';
import ferryIcon from 'icons/icon_ferry.svg';
import trunkIcon from 'icons/icon_trunk.svg';

const TRUNK_ROUTES = ['550', '560', '500', '510', '200', '570', '20', '30', '40'];
const RAIL_ROUTE_ID_REGEXP = /^300[12]/;
const SUBWAY_ROUTE_ID_REGEXP = /^31/;

const routeTypes = {
  TRAM: 'TRAM',
  BUS: 'BUS',
  OTHER: 'OTHER',
};

/**
 * Returns whether a route id is a so called number variant
 * @param {String} routeId - Route id
 * @returns {boolean}
 */
function isNumberVariant(routeId) {
  return /.{5}[0-9]/.test(routeId);
}

/**
 * Returns whether a route id is belongs to a rail route
 * @param {String} routeId - Route id
 * @returns {boolean}
 */
function isRailRoute(routeId) {
  return RAIL_ROUTE_ID_REGEXP.test(routeId);
}

/**
 * Returns whether a route id is belongs to a subway route
 * @param {String} routeId - Route id
 * @returns {boolean}
 */
function isSubwayRoute(routeId) {
  return SUBWAY_ROUTE_ID_REGEXP.test(routeId);
}

/**
 * Returns route id without area code or leading zeros
 * @param {String} routeId - Route id
 * @returns {String}
 */
function trimRouteId(routeId) {
  if (!routeId) {
    return '';
  } else if (isRailRoute(routeId) && isNumberVariant(routeId)) {
    return routeId.substring(1, 5).replace(RAIL_ROUTE_ID_REGEXP, '');
  } else if (isRailRoute(routeId)) {
    return routeId.replace(RAIL_ROUTE_ID_REGEXP, '');
  } else if (isSubwayRoute(routeId) && isNumberVariant(routeId)) {
    return routeId.substring(1, 5).replace(SUBWAY_ROUTE_ID_REGEXP, '');
  } else if (isSubwayRoute(routeId)) {
    return routeId.replace(SUBWAY_ROUTE_ID_REGEXP, '');
  } else if (isNumberVariant(routeId)) {
    // Do not show number variants
    return routeId.substring(1, 5).replace(/^[0]+/g, '');
  }
  return routeId.substring(1).replace(/^[0]+/g, '');
}

function getRouteType(type) {
  switch (type) {
    case '01':
      return routeTypes.BUS;
    case '02':
      return routeTypes.TRAM;
    default:
      return routeTypes.OTHER;
  }
}

/**
 * Returns true if the route segment is only for dropping off passengers
 * @returns {boolean}
 */
function isDropOffOnly({ pickupDropoffType }) {
  return pickupDropoffType === null || pickupDropoffType === 2;
}

const colorsByMode = {
  TRUNK: '#ff6319',
  TRAM: '#00985f',
  L_RAIL: '##00b2a9',
  RAIL: '#8c4799',
  SUBWAY: '#ff6319',
  BUS: '#007AC9',
  FERRY: '#00B9E4',
};

const iconsByMode = {
  BUS: busIcon,
  TRAM: tramIcon,
  L_RAIL: lRailIcon,
  RAIL: railIcon,
  SUBWAY: subwayIcon,
  FERRY: ferryIcon,
  TRUNK: trunkIcon,
};

function getColor(route) {
  if (route.trunkRoute) {
    return colorsByMode.TRUNK;
  }
  return colorsByMode[route.mode];
}

function getIcon(route) {
  if (route.trunkRoute) {
    return iconsByMode.TRUNK;
  }
  return iconsByMode[route.mode];
}

export {
  isNumberVariant,
  isRailRoute,
  isSubwayRoute,
  trimRouteId,
  isDropOffOnly,
  colorsByMode,
  iconsByMode,
  getColor,
  getIcon,
  getRouteType,
  routeTypes,
};
