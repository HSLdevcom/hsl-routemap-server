import React, { useState, useEffect } from 'react';
import renderQueue from 'util/renderQueue';

const hocFactory = (propName) => (WrappedComponent) => (props) => {
  const [state, setState] = useState({
    loading: !!props[propName],
    value: null,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const promise = props[propName];

    if (promise) {
      setState((prevState) => ({ ...prevState, loading: true }));
      renderQueue.add(promise);

      promise
        .then((value) => {
          if (isMounted) {
            setState({ value, loading: false, error: null });
            renderQueue.remove(promise);
          }
        })
        .catch((error) => {
          if (isMounted) {
            setState({ error, loading: false });
            renderQueue.remove(promise, { error });
          }
        });
    }

    return () => {
      isMounted = false;
      renderQueue.remove(promise);
    };
  }, [props[propName]]);

  const { loading, error, value } = state;

  if (loading || error) {
    return null;
  }

  const newProps = { ...props, [propName]: value };
  return <WrappedComponent {...newProps} />;
};

export default hocFactory;
