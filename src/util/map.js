const API_URL = process.env.GENERATE_API_URL || 'https://kartat.hsl.fi';

const scaleDefault = 5;

/**
 * Returns a map image
 * @param {Object} mapOptions - Options used to generate image
 * @returns {Promise} - Image as data URL
 */
// eslint-disable-next-line import/prefer-default-export
export function fetchMap(mapOptions, mapStyle, scale = scaleDefault) {
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ options: { ...mapOptions, scale }, style: mapStyle }),
  };
  console.log(`generating tileset with ${API_URL}/generateImage`);
  return fetch(`${API_URL}/generateImage`, options)
    .then(response => response.blob())
    .then(
      blob =>
        new Promise(resolve => {
          const reader = new window.FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => resolve(reader.result);
          console.info('Fetched map:');
        }),
    );
}
