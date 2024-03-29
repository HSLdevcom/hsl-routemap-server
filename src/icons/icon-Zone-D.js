import PropTypes from 'prop-types';
import React from 'react';

const DZone = (props) => (
  <div>
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 36 36"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
    >
      <title>icon-Zone-D-v2</title>
      <desc>Created with Sketch.</desc>
      <defs />
      <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
        <g id="icon-Zone-D-v2">
          <path
            d="M36,18.00096 C36,27.94176 27.9408,36.00096 18,36.00096 C8.0592,36.00096 0,27.94176 0,18.00096 C0,8.05776 8.0592,0.00096 18,0.00096 C27.9408,0.00096 36,8.05776 36,18.00096"
            id="Fill-1"
            fill="#007AC9"
          />
          <path
            d="M9.94704,8.85792 C9.94704,7.78992 10.77024,6.96672 11.83584,6.96672 L17.90304,6.96672 C24.60864,6.96672 29.24064,11.56992 29.24064,17.57472 L29.24064,17.63472 C29.24064,23.63952 24.60864,28.30512 17.90304,28.30512 L11.83584,28.30512 C10.77024,28.30512 9.94704,27.48192 9.94704,26.41152 L9.94704,8.85792 Z M17.90304,24.88992 C22.38384,24.88992 25.30944,21.87312 25.30944,17.69712 L25.30944,17.63472 C25.30944,13.45872 22.38384,10.38192 17.90304,10.38192 L13.69584,10.38192 L13.69584,24.88992 L17.90304,24.88992 Z"
            id="Fill-4"
            fill="#FFFFFF"
          />
        </g>
      </g>
    </svg>
  </div>
);

DZone.propTypes = {
  size: PropTypes.string.isRequired,
};

export default DZone;
