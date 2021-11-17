import React from 'react';
import PropTypes from 'prop-types';
import MapImage from 'components/map/mapImageContainer';
import ItemContainer from 'components/labelPlacement/itemContainer';
import ItemFixed from 'components/labelPlacement/itemFixed';
import ItemPositioned from 'components/labelPlacement/itemPositioned';

import AZone from 'icons/icon-Zone-A';
import BZone from 'icons/icon-Zone-B';
import CZone from 'icons/icon-Zone-C';
import DZone from 'icons/icon-Zone-D';

import { preventFromOverlap } from '../../util/terminals';
import { getTransformedCoord } from '../../util/arrows';
import TerminalSymbol from './terminalSymbol';
import TerminusSymbol from './terminusSymbol';
import TerminusLabel from './terminusLabel';
import IntermediateLabel from './intermediateLabel';
import StationName from './stationName';
import DirectionArrow from './directionArrow';
import StopSymbol from '../map/stopSymbol';
import Scalebar from '../map/scalebar';

import styles from './routeMap.css';

const STOP_RADIUS = 3.5;
const TERMINUS_SIZE = 5;
const TERMINAL_SIZE = 14;
const ARROW_SIZE = 12;
const ARROW_DISTANCE_FROM_ROAD = 10;

// Overlays
const INFO_MARGIN_BOTTOM = 78;
const INFO_MARGIN_LEFT = 44;

const getZoneIcon = (zone, size) => {
  switch (zone) {
    case 'A':
      return <AZone size={size} />;
    case 'B':
      return <BZone size={size} />;
    case 'C':
      return <CZone size={size} />;
    case 'D':
      return <DZone size={size} />;
    default:
      return <div />;
  }
};

const ZoneSymbol = props => (
  <div className={styles.zoneSymbol}>{getZoneIcon(props.zone, props.size)}</div>
);

ZoneSymbol.propTypes = {
  size: PropTypes.string,
  zone: PropTypes.string.isRequired,
};

ZoneSymbol.defaultProps = {
  size: '200px',
};

const RouteMap = props => {
  const mapStyle = {
    width: props.mapOptions.width,
    height: props.mapOptions.height,
  };

  const Attribution = () => <div className={styles.attribution}>&copy; OpenStreetMap</div>;

  const scaleStyle = {
    fontSize: `${props.configuration.scaleFontSize ? props.configuration.scaleFontSize : 12}px`,
  };

  const nonOverlappingStations = preventFromOverlap(props.projectedStations, TERMINAL_SIZE);
  const { projectedSymbols } = props;
  return (
    <div className={styles.root}>
      <div className={styles.map} style={mapStyle}>
        <MapImage
          options={props.mapOptions}
          components={props.mapComponents}
          date={props.date}
          routeFilter={props.configuration.routeFilter}
        />
      </div>
      <div className={styles.overlays}>
        <ItemContainer
          mapOptions={props.mapOptions}
          mapComponents={props.mapComponents}
          configuration={props.configuration}
          alphaChannel={props.alphaChannel}>
          {props.projectedTerminuses.map((terminus, index) => (
            <ItemFixed
              key={index}
              top={terminus.y - TERMINUS_SIZE / 2}
              left={terminus.x - TERMINUS_SIZE / 2}>
              <TerminusSymbol size={TERMINUS_SIZE} />
            </ItemFixed>
          ))}
          {props.projectedStops.map((stop, index) => (
            <ItemFixed
              key={index}
              top={stop.y - STOP_RADIUS}
              left={stop.x - STOP_RADIUS}
              allowCollision>
              <StopSymbol routes={stop.routes} size={STOP_RADIUS * 2} />
            </ItemFixed>
          ))}
          {nonOverlappingStations.map((station, index) => (
            <ItemFixed
              key={index}
              top={station.y - TERMINAL_SIZE / 2}
              left={station.x - TERMINAL_SIZE / 2}>
              <TerminalSymbol
                nameFi={station.nameFi}
                nameSv={station.nameSe}
                node={station.mode}
                size={TERMINAL_SIZE}
              />
            </ItemFixed>
          ))}
          {props.projectedIntermediates.map((intermediate, index) => (
            <ItemPositioned
              key={index}
              x={intermediate.x}
              y={intermediate.y}
              distance={0}
              allowHidden
              anglePriority={1}
              angle={intermediate.angle}>
              <IntermediateLabel label={intermediate.label} configuration={props.configuration} />
            </ItemPositioned>
          ))}
          {props.projectedIntermediates
            .filter(intermediate => !!intermediate.oneDirectionalAngle)
            .map((intermediate, index) => {
              const { transformedX, transformedY } = getTransformedCoord(
                intermediate.x,
                intermediate.y,
                intermediate.oneDirectionalAngle + 90,
                ARROW_DISTANCE_FROM_ROAD,
              );

              return (
                <ItemFixed
                  key={index}
                  top={transformedY - (ARROW_SIZE + 2) / 2}
                  left={transformedX - (ARROW_SIZE + 2) / 2}
                  transform={intermediate.oneDirectionalAngle}
                  fixedSize={ARROW_SIZE + 2}>
                  <DirectionArrow size={ARROW_SIZE} />
                </ItemFixed>
              );
            })}
          {props.projectedStations
            .filter(station => station.mode === '06' || station.mode === '12')
            .map((name, index) => (
              <ItemPositioned
                key={index}
                x={name.x}
                y={name.y}
                distance={5}
                anchorWidth={1}
                maxDistance={40}
                angle={45}
                distancePriority={6}
                alphaOverlapPriority={0.1}>
                <StationName
                  nameFi={name.nameFi}
                  nameSe={name.nameSe}
                  type={name.mode}
                  configuration={props.configuration}
                />
              </ItemPositioned>
            ))}
          {projectedSymbols &&
            projectedSymbols.length > 0 &&
            projectedSymbols.map((symbol, index) => (
              <ItemFixed key={index} left={symbol.sy} top={symbol.sx}>
                <ZoneSymbol size={symbol.size} zone={symbol.zone} />
              </ItemFixed>
            ))}
          {props.projectedTerminuses.map((terminus, index) => (
            <ItemPositioned
              key={index}
              x={terminus.x}
              y={terminus.y}
              distance={10}
              anchorWidth={1}
              distancePriority={terminus.lines.length > 5 ? 4 : 16}
              angle={45}>
              <TerminusLabel
                lines={terminus.lines}
                nameFi={terminus.nameFi}
                nameSe={terminus.nameSe}
                type={terminus.type}
                configuration={props.configuration}
              />
            </ItemPositioned>
          ))}
          <ItemFixed top={mapStyle.height - INFO_MARGIN_BOTTOM} left={INFO_MARGIN_LEFT}>
            <div style={scaleStyle}>
              <Scalebar
                targetWidth={
                  props.configuration.scaleLength ? props.configuration.scaleLength : 250
                }
                pixelsPerMeter={props.pxPerMeterRatio}
              />
              <Attribution />
            </div>
          </ItemFixed>
        </ItemContainer>
      </div>
    </div>
  );
};

const TerminusType = PropTypes.shape({
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  lines: PropTypes.arrayOf(PropTypes.string).isRequired,
  nameFi: PropTypes.string,
  nameSe: PropTypes.string,
});

const StationType = PropTypes.shape({
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  nameFi: PropTypes.string,
  nameSv: PropTypes.string,
  mode: PropTypes.string.isRequired,
});

const IntermediateLabelType = PropTypes.shape({
  type: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
});

const IntermediateType = PropTypes.shape({
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  label: PropTypes.arrayOf(IntermediateLabelType).isRequired,
});

const MapOptions = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  zoom: PropTypes.number.isRequired,
  center: PropTypes.arrayOf(PropTypes.number).isRequired,
};

const StopType = PropTypes.shape({
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  routes: PropTypes.arrayOf(
    PropTypes.shape({
      routeId: PropTypes.string.isRequired,
      mode: PropTypes.string.isRequired,
    }),
  ).isRequired,
});

const ConfigurationOptionsProps = {
  date: PropTypes.string.isRequired,
  scaleFontSize: PropTypes.number.isRequired,
  maxAnchorLength: PropTypes.number.isRequired,
  scaleLength: PropTypes.number,
};

RouteMap.propTypes = {
  date: PropTypes.string.isRequired,
  alphaChannel: PropTypes.object.isRequired,
  projectedStations: PropTypes.arrayOf(StationType).isRequired,
  projectedTerminuses: PropTypes.arrayOf(TerminusType).isRequired,
  projectedIntermediates: PropTypes.arrayOf(IntermediateType).isRequired,
  projectedStops: PropTypes.arrayOf(StopType).isRequired,
  projectedSymbols: PropTypes.arrayOf(Object).isRequired,
  mapOptions: PropTypes.shape(MapOptions).isRequired,
  mapComponents: PropTypes.object.isRequired, // eslint-disable-line
  pxPerMeterRatio: PropTypes.number.isRequired,
  configuration: PropTypes.shape(ConfigurationOptionsProps).isRequired,
};

export default RouteMap;
