import React from 'react';
import * as ReactDOMClient from 'react-dom/client';

import App from 'components/app';
import 'styles/base.css';

const rootContainer = document.body.appendChild(document.createElement('div'));
const root = ReactDOMClient.createRoot(rootContainer);
root.render(<App />);

if (module.hot) {
  module.hot.accept('components/app', () => {
    const NextApp = require('components/app').default; // eslint-disable-line
    root.render(<NextApp />, root);
  });
}
