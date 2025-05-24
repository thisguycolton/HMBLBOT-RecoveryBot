ARG RUBY_VERSION=3.2.3

FROM ruby:${RUBY_VERSION}-alpine AS builder

RUN apk add --no-cache \
  build-base \
  postgresql-dev \
  git \
  nodejs \
  yarn # optional if any JS dependencies needed for e.g. Stimulus

WORKDIR /app
COPY Gemfile* ./
RUN bundle install

FROM ruby:${RUBY_VERSION}-alpine AS runner

RUN apk add --no-cache \
  tzdata \
  nodejs \
  postgresql-dev

WORKDIR /app

RUN gem update --system && gem install bundler

COPY --from=builder /usr/local/bundle/ /usr/local/bundle/
COPY . .

# If you're using importmaps, skip assets:precompile
RUN bundle exec rails importmap:install

# Optional: you can precompile views or run setup commands here
# RUN bundle exec rails db:prepare

EXPOSE 3000

CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]