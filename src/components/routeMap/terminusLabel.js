import React from 'react';
import PropTypes from 'prop-types';
import { trimRouteId } from '../../util/domain';
import routeGeneralizer from '../../util/routeGeneralizer';

import style from './terminusLabel.css';

const TerminusLabel = ({ nameFi, nameSe, lines, configuration, trunkRouteIds }) => {
  const terminusStyle = {
    fontSize: `${configuration.terminusFontSize}px`,
    lineHeight: `${configuration.terminusFontSize}px`,
    maxWidth: `${configuration.terminusWidth}px`,
    color: '#0379c8',
  };

  function intersperse(arr, sep) {
    if (arr.length === 0) {
      return [];
    }

    return arr.slice(1).reduce((xs, x) => xs.concat([sep, x]), [arr[0]]);
  }

  const routes = routeGeneralizer(lines.map(id => trimRouteId(id))).map(item => {
    item.trunkRoute = trunkRouteIds.includes(item.text);
    item.style = style.bus;
    if (item.type === 'tram') {
      item.style = style.tram;
    }
    if (item.trunkRoute) {
      item.style = style.trunk;
    }
    return item;
  });
  return (
    <div className={style.label} style={terminusStyle}>
      {(nameFi || nameSe) && (
        <div>
          {nameFi && [
            <span key="nameFi" className={style.headerFi}>
              {nameFi}
            </span>,
            <br key="B1" />,
          ]}
          {nameSe &&
            nameSe !== nameFi && [
              <span key="nameSe" className={style.headerSe}>
                {nameSe}
              </span>,
              <br key="B2" />,
            ]}
        </div>
      )}
      {intersperse(
        routes.map((item, index) => (
          <span key={index} className={item.style}>
            {item.text}
          </span>
        )),
        ', ',
      )}
    </div>
  );
};

const TerminusConfiguration = {
  terminusFontSize: PropTypes.number.isRequired,
  terminusWidth: PropTypes.number.isRequired,
};

TerminusLabel.defaultProps = {
  nameFi: null,
  nameSe: null,
};

TerminusLabel.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.string).isRequired,
  configuration: PropTypes.shape(TerminusConfiguration).isRequired,
  nameFi: PropTypes.string,
  nameSe: PropTypes.string,
};

export default TerminusLabel;
