import PropTypes from 'prop-types';
import compose from 'recompose/compose';
import mapProps from 'recompose/mapProps';
import hslMapStyle from 'hsl-map-style';

import { fetchMap } from 'util/map';
import promiseWrapper from 'util/promiseWrapper';
import MapImage from './mapImage';

const propsMapper = mapProps(({ options, components, date, routeFilter }) => {
  const mapStyle = hslMapStyle.generateStyle({
    sourcesUrl: process.env.DIGITRANSIT_URL,
    queryParams: [
      {
        url: process.env.DIGITRANSIT_URL,
        name: 'digitransit-subscription-key',
        value: process.env.DIGITRANSIT_APIKEY,
      },
    ],
    components: {
      ...components,
      routes_with_departures_only: { enabled: false }, // To show routes also in the future.
    },
    routeFilter,
    joreDate: date,
  });

  return { src: fetchMap(options, mapStyle) };
});

const hoc = compose(propsMapper, promiseWrapper('src'));

const MapImageContainer = hoc(MapImage);

MapImageContainer.defaultProps = {
  // Used only when routes or stops component is enabled
  date: null,
};

MapImageContainer.optionsShape = {
  center: PropTypes.array.isRequired,
  zoom: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  scale: PropTypes.number,
};

MapImageContainer.propTypes = {
  options: PropTypes.shape(MapImageContainer.optionsShape).isRequired,
  components: PropTypes.objectOf(
    PropTypes.shape({
      enabled: PropTypes.bool.isRequired,
    }),
  ).isRequired,
  date: PropTypes.string,
  routeFilter: PropTypes.array.isRequired,
  extraLayers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
    }),
  ),
};

export default MapImageContainer;
