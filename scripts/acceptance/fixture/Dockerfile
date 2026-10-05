FROM node:22-alpine
ARG VERSION
ENV VERSION=$VERSION
COPY server.mjs /server.mjs
USER node
EXPOSE 8080
CMD ["node", "/server.mjs"]
