import React, { Component } from 'react';
import PropTypes from 'prop-types';

class ItemPositioned extends Component {
  constructor(props) {
    super(props);
    // Use anchor coordinates before actual position is computed
    this.state = {
      top: props.y,
      left: props.x,
      visible: props.visible || !props.allowHidden,
    };
    this.root = React.createRef();
  }

  setPosition(top, left, visible) {
    const finalVisible = visible || !this.props.allowHidden;

    this.setState({
      top,
      left,
      visible: finalVisible,
    });

    return finalVisible;
  }

  getVisible() {
    return this.state.visible;
  }

  getPosition() {
    return {
      width: this.root.offsetWidth,
      height: this.root.offsetHeight,
      x: this.props.x,
      y: this.props.y,
      initialDistance: this.props.distance,
      initialAngle: this.props.angle,
      visible: this.state.visible,
      anglePriority: this.props.anglePriority,
      distancePriority: this.props.distancePriority,
      showBoxAndAnchor: this.props.showBoxAndAnchor,
      lineOverlapPriority: this.props.lineOverlapPriority,
      alphaOverlapPriority: this.props.alphaOverlapPriority,
      maxDistance: this.props.maxDistance,
      anchorWidth: this.props.anchorWidth,
      allowHidden: this.props.allowHidden,
      allowCollision: this.props.allowCollision,
      shouldBeVisible: this.props.shouldBeVisible,
    };
  }

  render() {
    const style = {
      ...this.state,
      position: 'absolute',
      visibility: this.state.visible ? 'visible' : 'hidden',
    };

    if (this.props.transform !== 0) {
      style.transform = `rotate(${this.props.transform}deg)`;
    }

    return (
      <div
        ref={(ref) => {
          this.root = ref;
        }}
        style={style}
      >
        {this.props.children}
      </div>
    );
  }
}

ItemPositioned.defaultProps = {
  angle: 0,
  visible: true,
  allowHidden: false,
  anglePriority: 0,
  distancePriority: 1,
  lineOverlapPriority: 1,
  showBoxAndAnchor: true,
  alphaOverlapPriority: 1,
  maxDistance: null,
  anchorWidth: 0.5,
  transform: 0,
  allowCollision: false,
  shouldBeVisible: true,
  distance: 0,
};

ItemPositioned.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  distance: PropTypes.number,
  angle: PropTypes.number,
  children: PropTypes.element.isRequired,
  visible: PropTypes.bool,
  allowHidden: PropTypes.bool,
  anglePriority: PropTypes.number,
  distancePriority: PropTypes.number,
  lineOverlapPriority: PropTypes.number,
  showBoxAndAnchor: PropTypes.bool,
  alphaOverlapPriority: PropTypes.number,
  maxDistance: PropTypes.number,
  anchorWidth: PropTypes.number,
  transform: PropTypes.number,
  allowCollision: PropTypes.bool,
  shouldBeVisible: PropTypes.bool,
};

export default ItemPositioned;
