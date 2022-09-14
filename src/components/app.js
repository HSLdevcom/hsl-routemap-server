import React, { Component } from 'react';

import { ApolloClient } from 'apollo-client';
import { createHttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloProvider } from 'react-apollo';

import RouteMap from 'components/routeMap/routeMapContainer';
import renderQueue from 'util/renderQueue';

function handleError(error) {
  console.error(error); // eslint-disable-line no-console
  // Inform server that runs puppeteer about the problem.
  window.renderStatus = 'error';
}

let props = false;

try {
  const params = new URLSearchParams(window.location.search.substring(1));
  props = JSON.parse(params.get('props'));
} catch (error) {
  handleError(new Error('Failed to parse url fragment'));
}

if (!props) {
  handleError(new Error('Invalid props'));
}

const client = new ApolloClient({
  link: createHttpLink({
    uri: process.env.JORE_GRAPHQL_URL || 'https://kartat.hsl.fi/jore/graphql',
  }),
  cache: new InMemoryCache(),
});

class App extends Component {
  componentDidMount() {
    if (this.root) {
      renderQueue.onEmpty(error => {
        if (error) {
          handleError(error);
          return;
        }
        console.log('Rendering finished');
        window.renderStatus = 'ready';
      });
    }
  }

  // eslint-disable-next-line class-methods-use-this
  componentDidCatch(error, info) {
    console.log(JSON.stringify({ error, info }));
    handleError(error);
  }

  render() {
    if (!props) {
      return null;
    }

    const rootStyle = {
      display: 'inline-block',
      width: props.mapOptions.width,
      height: props.mapOptions.height,
    };

    return (
      <div
        id="rootImageElement"
        style={rootStyle}
        ref={ref => {
          this.root = ref;
        }}>
        <ApolloProvider client={client}>
          <RouteMap {...props} /> {/* eslint-disable-line react/jsx-props-no-spreading */}
        </ApolloProvider>
      </div>
    );
  }
}

export default App;
