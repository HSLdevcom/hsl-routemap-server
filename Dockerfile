FROM node:16-buster-slim

# This installs the necessary libs to make the bundled version of Chromium that Pupppeteer installs work
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -yq wget curl gnupg pdftk fontconfig fonts-liberation ca-certificates --no-install-recommends \
    # This installs the necessary libs to make the bundled version of Chromium that Puppeteer installs work
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list' \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -yq google-chrome-stable libxss1 --no-install-recommends \
  && wget -O azcopy_v10.tar.gz https://aka.ms/downloadazcopy-v10-linux && tar -xf azcopy_v10.tar.gz --strip-components=1 && rm azcopy_v10.tar.gz \
  && mv ./azcopy /usr/bin/ \
  && rm -rf /var/lib/apt/lists/*

ENV WORK /opt/publisher
ENV NODE_ENV production

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

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
