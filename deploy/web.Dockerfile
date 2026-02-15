FROM node:20-alpine AS build

WORKDIR /app

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client ./client

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_SCHOOL_NAME=
ARG VITE_SCHOOLS=
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_SCHOOL_NAME=${VITE_SCHOOL_NAME}
ENV VITE_SCHOOLS=${VITE_SCHOOLS}

RUN cd client && npm run build

FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/client/dist /srv
