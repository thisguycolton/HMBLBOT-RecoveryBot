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
COPY package.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Build assets
RUN bundle exec rails assets:precompile RAILS_ENV=production

# Start server
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]