FROM ruby:3.2.3

# Install system dependencies
RUN apt-get update -qq && apt-get install -y \
  build-essential \
  libpq-dev \
  curl \
  git \
  gnupg

# Install Node.js 20.x and Yarn
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
  apt-get install -y nodejs && \
  npm install -g yarn

# Set working directory
WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Install node modules before copying the rest
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy the rest of the app
COPY . .

# Build assets, unless bin/deploy already built them on the deploying machine.
# Building on the server runs the droplet out of memory and takes CapRover down.
RUN if [ -f public/vite/.vite/manifest.json ]; then \
      echo "Using prebuilt Vite assets"; \
    else \
      yarn vite build; \
    fi

# Run pending migrations, then start the server
CMD ["sh", "-c", "bundle exec rails db:migrate && exec bundle exec puma -C config/puma.rb"]