# Dockerfile

FROM ruby:3.2

# Install dependencies
RUN apt-get update -qq && apt-get install -y nodejs postgresql-client yarn

# Set working directory
WORKDIR /app

# Install bundler
RUN gem install bundler

# Copy Gemfiles and install gems
COPY Gemfile Gemfile.lock ./
RUN bundle install

# Copy entire app
COPY . .

# Precompile assets and Vite build
RUN bundle exec rails assets:precompile RAILS_ENV=production \
  && bin/vite build

# Start the server (if using puma)
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]