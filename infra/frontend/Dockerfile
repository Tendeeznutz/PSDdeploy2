# CRA dev server — functional for internal/staging use.
# react-scripts start is used intentionally per project decision.
FROM node:20-alpine

RUN adduser -D -u 1001 airserve

WORKDIR /app
COPY Integrated_Scheduling_System-master/appointment_scheduling/frontend/package*.json ./
RUN npm install

COPY Integrated_Scheduling_System-master/appointment_scheduling/frontend/ .

ENV HOST=0.0.0.0
ENV PORT=3000

USER airserve
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://localhost:3000', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]
