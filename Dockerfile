FROM node:16-buster-slim

# This installs the necessary libs to make the bundled version of Chromium that Pupppeteer installs work
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq \
    wget curl gnupg pdftk libgconf-2-4 gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 \
    libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 \
    libnss3 lsb-release xdg-utils --no-install-recommends \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq $(apt-cache depends google-chrome-unstable | awk '/depends:/{print$2}') --no-install-recommends \
  && wget -O azcopy_v10.tar.gz https://aka.ms/downloadazcopy-v10-linux && tar -xf azcopy_v10.tar.gz --strip-components=1 \
  && cp ./azcopy /usr/bin/ \
  && rm -rf /var/lib/apt/lists/*

ENV WORK /opt/publisher

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

# Add privileges for puppeteer user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
  && mkdir -p /home/pptruser/Downloads \
  && chown -R pptruser:pptruser /home/pptruser \
  && chown -R pptruser:pptruser ${WORK}

# Run user as non privileged.
USER pptruser

# Install app dependencies
COPY yarn.lock package.json ${WORK}/
RUN yarn && yarn cache clean

# Bundle app source
COPY . ${WORK}

ARG BUILD_ENV=prod
COPY .env.${BUILD_ENV} ${WORK}/.env

RUN yarn build

EXPOSE 4000

CMD \
  ./fonts.sh && \
  fc-cache -f -v && \
  yarn run forever start -c "yarn serve" dist/ && \
  yarn run forever start -c "yarn server" ./ && \
  yarn run forever start -c "yarn worker" ./ && \
  sleep 3 && \
  yarn run forever -f logs 1
