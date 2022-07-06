import React from 'react';
import PropTypes from 'prop-types';

import style from './intermediateLabel.css';

const IntermediateLabel = ({ trunkRouteIds, label, configuration }) => {
  const intermediateStyle = {
    fontSize: `${configuration.intermediatePointFontSize}px`,
    lineHeight: `${configuration.intermediatePointFontSize}px`,
    maxWidth: `${configuration.intermediatePointWidth}px`,
  };

  function intersperse(arr, sep) {
    if (arr.length === 0) {
      return [];
    }

    return arr.slice(1).reduce((xs, x) => xs.concat([sep, x]), [arr[0]]);
  }

  const labelsWithMode = label.map(item => {
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
    <div className={style.label} style={intermediateStyle}>
      {intersperse(
        labelsWithMode.map((item, index) => (
          <span key={index} className={item.style}>
            {item.text}
          </span>
        )),
        ', ',
      )}
    </div>
  );
};

const IntermediateConfiguration = {
  intermediatePointFontSize: PropTypes.number.isRequired,
  intermediatePointWidth: PropTypes.number.isRequired,
};

const IntermediateLabelType = PropTypes.shape({
  type: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
});

IntermediateLabel.propTypes = {
  label: PropTypes.arrayOf(IntermediateLabelType).isRequired,
  configuration: PropTypes.shape(IntermediateConfiguration).isRequired,
};

export default IntermediateLabel;
