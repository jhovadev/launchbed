# Optional container for the built web app. Not used by the default workflow.
FROM oven/bun:1.4.4 AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile && bun run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --from=build /repo/apps/web/dist ./dist
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
