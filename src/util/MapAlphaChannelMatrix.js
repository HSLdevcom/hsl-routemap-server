import hslMapStyle from 'hsl-map-style';
import { fetchMap } from 'util/map';

function getIfOccupied(byteArray, mapOptions) {
  return (x, y) => byteArray[Math.floor(x) + mapOptions.width * Math.floor(y)];
}

class Matrix {
  constructor(mapOptions, mapComponents, routeFilter) {
    this.mapOptions = mapOptions;
    this.mapOptions.scale = 1;
    this.mapComponents = mapComponents;

    this.mapStyle = hslMapStyle.generateStyle({
      sourcesUrl: process.env.DIGITRANSIT_URL,
      queryParams: [
        {
          url: process.env.DIGITRANSIT_URL,
          name: 'digitransit-subscription-key',
          value: process.env.DIGITRANSIT_APIKEY,
        },
      ],
      components: {
        ...mapComponents,
        base: { enabled: false },
        routes_with_departures_only: { enabled: false },
      },
      routeFilter,
    });
  }

  initialize(callback) {
    const byteArray = new Int8Array(this.mapOptions.height * this.mapOptions.width);
    fetchMap(this.mapOptions, this.mapStyle, this.mapOptions.scale).then(res => {
      console.info('fetched bit array map');
      const canvas = document.createElement('canvas');
      canvas.width = this.mapOptions.width;
      canvas.height = this.mapOptions.height;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = res;
      let counter = 0;
      img.onload = () => {
        console.info('loading bit array map');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, this.mapOptions.width, this.mapOptions.height);

        for (let x = 0; x < this.mapOptions.width; x++) {
          for (let y = 0; y < this.mapOptions.height; y++) {
            const result = !!imageData.data[(x + this.mapOptions.width * y) * 4 + 3];
            byteArray[x + this.mapOptions.width * y] = result;
            if (result) counter++;
          }
        }
        console.info(
          `Loaded bit array: ${counter}/${this.mapOptions.width * this.mapOptions.height}`,
        );
        callback(byteArray);
      };
    });
  }
}

export { getIfOccupied, Matrix };
