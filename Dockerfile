FROM node:20-bookworm-slim

RUN set -eux; \
  apt-get update; \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg wget pdftk fontconfig fonts-liberation supervisor; \
  install -d -m 0755 /etc/apt/keyrings; \
  curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /etc/apt/keyrings/google-chrome.gpg; \
  chmod a+r /etc/apt/keyrings/google-chrome.gpg; \
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list; \
  apt-get update; \
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends google-chrome-stable libxss1; \
  rm -rf /var/lib/apt/lists/*


ENV WORK=/opt/publisher
# ENV NODE_ENV production # Cannot use until devdependency list is fixed in package.json

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
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

ARG DIGITRANSIT_APIKEY
ENV DIGITRANSIT_APIKEY=${DIGITRANSIT_APIKEY}
RUN yarn build

EXPOSE 4000

CMD ./fonts.sh && fc-cache -f -v && exec supervisord -c /etc/supervisor/conf.d/supervisord.conf

