
ARG RUBY_VERSION=3.2.3

FROM ruby:${RUBY_VERSION}-alpine AS builder
RUN apk add \
  build-base \
  postgresql-dev
COPY Gemfile* ./
RUN bundle install
FROM ruby:3.2.3-alpine AS runner
RUN apk add \
  tzdata \
  nodejs \
  postgresql-dev
WORKDIR /app
RUN gem update --system && gem install bundler

# Use what the base image provides rather than create our own  app directory
WORKDIR /usr/src/app/

# Add a script to be executed every time the container starts.
COPY .dockerdev/entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]

EXPOSE 3000

CMD ["bundle", "exec", "rails", "s", "-b", "0.0.0.0"]