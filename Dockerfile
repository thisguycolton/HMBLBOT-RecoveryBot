# Dockerfile

FROM ruby:3.2.3

# Install system dependencies
RUN apt-get update -qq && apt-get install -y \
  build-essential \
  libpq-dev \
  curl \
  git \
  gnupg \
  # Node.js + npm
  nodejs \
  npm \
  # Yarn (optional but common)
  && npm install --global yarn

# Set working directory
WORKDIR /app

# Install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Install node modules before copying the rest
COPY package.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Build assets
RUN bundle exec rails assets:precompile RAILS_ENV=production

# Start server
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]