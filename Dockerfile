FROM node:12

# This installs the necessary libs to make the bundled version of Chromium that Pupppeteer installs work
RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq wget curl pdftk libgconf-2-4 --no-install-recommends \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -yq $(apt-cache depends google-chrome-unstable | awk '/Depends:/{print$2}') --no-install-recommends \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /src/*.deb

# Install Azure CLI to download the fonts
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

ENV WORK /opt/publisher

# Create app directory
RUN mkdir -p ${WORK}
WORKDIR ${WORK}

RUN apt-get update \
    && apt-get install -y wget libxss1

# Add privileges for puppeteer user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
  && mkdir -p /home/pptruser/Downloads \
  && chown -R pptruser:pptruser /home/pptruser \
  && chown -R pptruser:pptruser ${WORK}

# Run user as non privileged.
USER pptruser

# Install app dependencies
COPY yarn.lock ${WORK}
COPY package.json ${WORK}
RUN yarn

# Bundle app source
COPY . ${WORK}

ARG BUILD_ENV=production
COPY .env.${BUILD_ENV} ${WORK}/.env

RUN yarn build

EXPOSE 4000

CMD \
  ./fonts.sh && \
  fc-cache -f -v && \
  yarn run forever start -c "yarn serve" ./ && \
  yarn run forever start -c "yarn server" ./ && \
  sleep 3 && \
  yarn run forever -f logs 1
