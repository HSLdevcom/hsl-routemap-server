import React, { Component } from 'react';
import PropTypes from 'prop-types';
import renderQueue from 'util/renderQueue';

import ItemOverlay from './itemOverlay';
import OptimizePositionsWorker from './optimizePositions.worker';

import styles from './itemContainer.css';

/**
 * Container that optimizes the positions of its children
 */
class ItemContainer extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.updateChildren();
  }

  componentDidUpdate(prevProps) {
    // Only restart the worker when the alpha channel image has arrived or changed.
    if (prevProps.alphaChannel !== this.props.alphaChannel) {
      this.worker.terminate();
      this.updateChildren();
    }
  }

  componentWillUnmount() {
    this.worker.terminate();
  }

  updateChildren() {
    renderQueue.add(this);

    const boundingBox = {
      left: 0,
      top: 0,
      width: this.root.offsetWidth,
      height: this.root.offsetHeight,
    };

    // Get refs to mounted children
    const refs = this.childRefs.filter((ref) => !!ref);

    // Get initial positions
    const initialPositions = refs.map((ref) => ref.getPosition());

    this.worker = new OptimizePositionsWorker();

    this.worker.addEventListener('message', (event) => {
      const positions = event.data;
      refs.forEach((ref, index) => {
        positions[index].visible = ref.setPosition(
          positions[index].top,
          positions[index].left,
          positions[index].visible,
        );
      });

      this.setState({
        items: positions.filter(({ isFixed, visible }) => !isFixed && visible),
      });

      this.setState({ items: positions.filter(({ isFixed }) => !isFixed) });
      renderQueue.remove(this);
    });

    this.worker.addEventListener('error', (event) => {
      console.error(`[labelPlacement] Worker error — ${event.message}`); // eslint-disable-line no-console
      renderQueue.remove(this, { error: new Error(event.message) });
    });

    if (this.props.alphaChannel) {
      this.worker.postMessage({
        positions: initialPositions,
        boundingBox,
        alphaByteArray: this.props.alphaChannel,
        mapOptions: this.props.mapOptions,
        configuration: this.props.configuration,
      });
    }
  }

  render() {
    this.childRefs = [];
    const children = React.Children.map(this.props.children, (child, index) => {
      const props = {
        ref: (ref) => {
          this.childRefs[index] = ref;
        },
      };
      return child ? React.cloneElement(child, props) : null;
    });
    return (
      <div
        className={styles.root}
        ref={(ref) => {
          this.root = ref;
        }}>
        {this.state.items && (
          <ItemOverlay
            width={this.root.offsetWidth}
            height={this.root.offsetHeight}
            items={this.state.items.filter(({ visible }) => visible)}
          />
        )}
        {children}
      </div>
    );
  }
}

const MapOptions = {
  height: PropTypes.number.isRequired,
  width: PropTypes.number.isRequired,
  center: PropTypes.array.isRequired,
  zoom: PropTypes.number.isRequired,
};

const ConfigurationOptionsProps = {
  date: PropTypes.string.isRequired,
  scaleLength: PropTypes.number.isRequired,
  maxAnchorLength: PropTypes.number.isRequired,
};

ItemContainer.propTypes = {
  children: PropTypes.node.isRequired, // ItemFixed or ItemPositioned components
  mapOptions: PropTypes.shape(MapOptions).isRequired,
  mapComponents: PropTypes.object.isRequired, // eslint-disable-line
  configuration: PropTypes.shape(ConfigurationOptionsProps).isRequired,
  alphaChannel: PropTypes.object.isRequired,
};

export default ItemContainer;
