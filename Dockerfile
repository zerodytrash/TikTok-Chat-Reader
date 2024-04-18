FROM node:19-alpine

WORKDIR /app
RUN apk add git
RUN git clone https://github.com/zerodytrash/TikTok-Chat-Reader.git

WORKDIR TikTok-Chat-Reader

RUN npm i
