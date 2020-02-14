import compose from 'recompose/compose';
import PropTypes from 'prop-types';
import { graphql } from 'react-apollo';
import mapProps from 'recompose/mapProps';
import gql from 'graphql-tag';
import { PerspectiveMercatorViewport } from 'viewport-mercator-project';
import {
  trimRouteId,
  isSubwayRoute,
  isRailRoute,
  isNumberVariant,
  isDropOffOnly,
  getRouteType,
} from 'util/domain';
import { getMostCommonAngle, getOneDirectionalAngle } from 'util/routeAngles';
import apolloWrapper from 'util/apolloWrapper';
import flatMap from 'lodash/flatMap';
import routeCompare from 'util/routeCompare';
import { withStateHandlers, lifecycle, branch } from 'recompose';
import renderQueue from 'util/renderQueue';

import { Matrix } from '../../util/MapAlphaChannelMatrix';
import routeGeneralizer from '../../util/routeGeneralizer';
import RouteMap from './routeMap';

const mapPositionMapper = mapProps(props => {
  const { mapOptions, configuration } = props;

  const viewport = new PerspectiveMercatorViewport({
    longitude: mapOptions.center[0],
    latitude: mapOptions.center[1],
    zoom: mapOptions.zoom,
    width: mapOptions.width,
    height: mapOptions.height,
  });
  const longitude = mapOptions.center[0];
  const latitude = mapOptions.center[1];

  const [minLon, minLat] = viewport.unproject([0, 0], { topLeft: true });
  const [maxLon, maxLat] = viewport.unproject([mapOptions.width, mapOptions.height], {
    topLeft: true,
  });

  return {
    ...props,
    minLat,
    minLon,
    maxLat,
    maxLon,
    width: mapOptions.width,
    height: mapOptions.height,
    longitude,
    latitude,
    configuration,
    date: props.configuration.date,
    nearBuses: props.configuration.nearBuses,
  };
});

const nearbyTerminals = gql`
  query nearbyTerminals(
    $minLat: Float!
    $minLon: Float!
    $maxLat: Float!
    $maxLon: Float!
    $date: Date!
    $nearBuses: Boolean
  ) {
    stations: getStations(
      minLat: $minLat
      minLon: $minLon
      maxLat: $maxLat
      maxLon: $maxLon
      date: $date
    ) {
      nodes {
        nameFi
        nameSe
        lat
        lon
        type
      }
    }
    terminus: getTerminusByDateAndBboxGrouped(
      date: $date
      minLat: $minLat
      minLon: $minLon
      maxLat: $maxLat
      maxLon: $maxLon
      onlyNearBuses: $nearBuses
    ) {
      nodes {
        lines
        stopAreaId
        type
        lon
        lat
        terminalId
        nameFi
        nameSe
      }
    }
    intermediates: getSectionIntermediates(
      minLat: $minLat
      minLon: $minLon
      maxLat: $maxLat
      maxLon: $maxLon
      onlyNearBuses: $nearBuses
    ) {
      nodes {
        routes
        lon
        lat
        angles
        length
      }
    }
    stopGroups: getStopGroupedByShortIdByBboxAndDate(
      minLat: $minLat
      minLon: $minLon
      maxLat: $maxLat
      maxLon: $maxLon
      onlyNearBuses: $nearBuses
      date: $date
    ) {
      nodes {
        stopIds
        shortId
        lat
        lon
        nameFi
        nameSe
        stops {
          nodes {
            calculatedHeading
            routeSegments: routeSegmentsForDate(date: $date) {
              nodes {
                routeId
                hasRegularDayDepartures(date: $date)
                pickupDropoffType
                route {
                  nodes {
                    destinationFi
                    destinationSe
                    mode
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const terminalMapper = mapProps(props => {
  const stations = props.data.stations.nodes;
  const terminuses = props.data.terminus.nodes;
  const intermediates = props.data.intermediates.nodes;
  const stops = props.data.stopGroups.nodes;

  const viewport = new PerspectiveMercatorViewport({
    longitude: props.mapOptions.center[0],
    latitude: props.mapOptions.center[1],
    zoom: props.mapOptions.zoom,
    width: props.width,
    height: props.height,
  });

  const projectedStations = stations.map(stop => {
    const [x, y] = viewport.project([parseFloat(stop.lon), parseFloat(stop.lat)]);

    return {
      nameFi: stop.nameFi,
      nameSe: stop.nameSe,
      mode: stop.type,
      x,
      y,
    };
  });

  const projectedStops = stops
    .map(stop => {
      const [x, y] = viewport.project([parseFloat(stop.lon), parseFloat(stop.lat)]);

      return {
        x,
        y,
        routes: flatMap(stop.stops.nodes, node =>
          node.routeSegments.nodes
            .filter(routeSegment => !isNumberVariant(routeSegment.routeId))
            .filter(routeSegment => !isDropOffOnly(routeSegment))
            .filter(routeSegment => routeSegment.route.nodes.length)
            .map(routeSegment => ({
              routeId: trimRouteId(routeSegment.routeId),
              destinationFi: routeSegment.route.nodes[0].destinationFi,
              destinationSe: routeSegment.route.nodes[0].destinationSe,
              mode: routeSegment.route.nodes[0].mode,
            })),
        ).sort(routeCompare),
      };
    })
    .filter(stop => stop.routes.length);

  const projectedIntermediates = intermediates
    .map(intermediate => ({
      ...intermediate,
      routes: intermediate.routes.filter(
        id => !isRailRoute(id) && !isSubwayRoute(id) && id !== null,
      ),
    }))
    .map(intermediate => ({
      ...intermediate,
      label: routeGeneralizer(intermediate.routes.map(id => trimRouteId(id))),
    }))
    .filter(
      intermediate =>
        intermediate.label.length > 0 &&
        (intermediate.label.length < 50 ||
          (intermediate.length > 250 && intermediate.label.length < 100) ||
          intermediate.length > 500),
    )
    .map(intermediate => ({
      ...intermediate,
      angle: getMostCommonAngle(intermediate.angles),
      oneDirectionalAngle: getOneDirectionalAngle(intermediate.angles),
    }))
    .map(intermediate => {
      const [x, y] = viewport.project([parseFloat(intermediate.lon), parseFloat(intermediate.lat)]);
      return {
        ...intermediate,
        x,
        y,
      };
    });

  const projectedTerminuses = terminuses
    .map(terminus => {
      const [x, y] = viewport.project([parseFloat(terminus.lon), parseFloat(terminus.lat)]);

      return {
        ...terminus,
        lines: terminus.lines.filter(id => !isRailRoute(id) && !isSubwayRoute(id)),
        type: getRouteType(terminus.type),
        x,
        y,
      };
    })
    .filter(terminus => terminus.lines.length > 0);

  const mapOptions = {
    center: [props.longitude, props.latitude],
    width: props.width,
    height: props.height,
    zoom: props.mapOptions.zoom,
  };

  const mapComponents = {
    text_fisv: { enabled: true },
    municipal_borders: { enabled: true },
    ticket_zones: { enabled: true },
    routes: { enabled: true },
  };

  if (props.configuration.zoneLabels) {
    mapComponents.ticket_zone_labels = { enabled: true };
  }

  if (props.configuration.nearBuses) {
    mapComponents.near_bus_routes = { enabled: true };
  } else {
    mapComponents.regular_routes = { enabled: true };
  }

  return {
    mapOptions,
    configuration: props.configuration,
    pxPerMeterRatio: viewport.getDistanceScales().pixelsPerMeter[0],
    mapComponents,
    projectedStations,
    projectedTerminuses,
    projectedIntermediates,
    projectedStops,
    date: props.date,
  };
});

const hoc = compose(
  mapPositionMapper,
  graphql(nearbyTerminals),
  apolloWrapper(terminalMapper),
  compose(
    withStateHandlers(null, {
      onData: state => data => ({
        // eslint-disable-line
        alphaChannel: data,
      }),
    }),
    lifecycle({
      componentDidMount() {
        renderQueue.add(this);
        const alphaChannelMatrix = new Matrix(this.props.mapOptions, this.props.mapComponents);
        alphaChannelMatrix.initialize(alphaChannelByteArray => {
          this.props.onData(alphaChannelByteArray);
          renderQueue.remove(this);
        });
      },
    }),
    branch(props => !props.alphaChannel, () => () => null),
  ),
);

const RouteMapContainer = hoc(RouteMap);

RouteMapContainer.defaultProps = {};

const MapOptionsProps = {
  bearing: PropTypes.number.isRequired,
};

const ConfigurationOptionsProps = {
  date: PropTypes.string.isRequired,
  nearBuses: PropTypes.bool.isRequired,
};

RouteMapContainer.propTypes = {
  mapOptions: PropTypes.shape(MapOptionsProps).isRequired,
  configuration: PropTypes.shape(ConfigurationOptionsProps).isRequired,
};

export default RouteMapContainer;
