# Use an official Node.js image.
# https://hub.docker.com/_/node
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# If you are building your code for production
# RUN npm ci --omit=dev
# For development, or if you don't have a package-lock.json:
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Creates a .env file from environment variables
RUN printenv | grep -E '(PORT|SESSIONID|ENABLE_RATE_LIMIT)' > .env

EXPOSE 8081

CMD [ "node", "server.js" ]
