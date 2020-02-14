import React from 'react';
import PropTypes from 'prop-types';

import { InlineSVG } from 'components/util';

import SubwayIcon from 'icons/icon_subway.svg';
import BusIcon from 'icons/icon_bus.svg';
import FerryIcon from 'icons/icon_ferry.svg';
import RailIcon from 'icons/icon_rail.svg';

function getIcon(node) {
  switch (node) {
    case '06':
      return SubwayIcon;
    case '01':
      return BusIcon;
    case '07':
      return FerryIcon;
    case '12':
      return RailIcon;
    default:
      return null;
  }
}

const TerminalSymbol = props => {
  const icon = getIcon(props.node);

  const divStyle = {
    width: props.size,
    height: props.size,
    fontSize: '12px',
  };

  return icon && <InlineSVG src={icon} style={divStyle} width={props.size} height={props.size} />;
};

TerminalSymbol.propTypes = {
  size: PropTypes.number.isRequired,
  node: PropTypes.string.isRequired,
};

export default TerminalSymbol;
