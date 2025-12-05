# Stage 1: Build the Website
FROM node:20-alpine as build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using 'npm ci' for clean install)
RUN npm ci

# Copy source code
COPY . .

# --- VARIABLES SECTION ---
# We declare that we expect these variables from Dokploy
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# We inject them into the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# -------------------------

# Build the React app
RUN npm run build

# Stage 2: Serve the Website
FROM nginx:alpine

# Clean default nginx files
RUN rm -rf /usr/share/nginx/html/*

# Copy the built website from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
