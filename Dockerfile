
ARG RUBY_VERSION=3.2.3

FROM ruby:${RUBY_VERSION}-alpine AS builder
RUN curl -sL https://deb.nodesource.com/setup_16.x | bash - && \
  apk add nodejs build-essential
RUN apk add \
  build-base \
  postgresql-dev \
  git
COPY Gemfile* ./
RUN bundle install
FROM ruby:3.2.3-alpine AS runner
RUN apk add \
  tzdata \
  nodejs \
  postgresql-dev
WORKDIR /app
RUN gem update --system && gem install bundler

COPY --from=builder /usr/local/bundle/ /usr/local/bundle/
COPY ./ ./


EXPOSE 3000

CMD bin/vite dev & bundle exec rails s -b 0.0.0.0