import React, { Component } from 'react';
import PropTypes from 'prop-types';

class ItemFixed extends Component {
  constructor(props) {
    super(props);
    this.state = { top: props.top, left: props.left };
    this.visible = true;
    this.root = React.createRef();
  }

  setPosition(top, left) {
    this.setState({ top, left });
  }

  getVisible() {
    return this.visible;
  }

  getPosition() {
    return {
      top: this.props.top,
      left: this.props.left,
      width: this.root.offsetWidth,
      height: this.root.offsetHeight,
      isFixed: true,
      visible: this.visible,
      anglePriority: 1,
      distancePriority: 1,
      lineOverlapPriority: 1,
      alphaOverlapPriority: 1,
      allowCollision: this.props.allowCollision,
      shouldBeVisible: true,
    };
  }

  render() {
    const style = { ...this.state, position: 'absolute' };

    if (this.props.transform !== 0) {
      style.transform = `rotate(${this.props.transform}deg)`;
    }
    if (this.props.fixedSize) {
      style.width = `${this.props.fixedSize}px`;
      style.height = `${this.props.fixedSize}px`;
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

ItemFixed.defaultProps = {
  fixedSize: null,
  allowCollision: false,
  transform: 0,
};

ItemFixed.propTypes = {
  top: PropTypes.number.isRequired,
  left: PropTypes.number.isRequired,
  children: PropTypes.element.isRequired,
  transform: PropTypes.number,
  fixedSize: PropTypes.number,
  allowCollision: PropTypes.bool,
};

export default ItemFixed;
